import LambdaClient from "aws-sdk/clients/lambda";
import { EJSON } from "bson";

const MONGO_CONNECTION_ERRORS = ["MongoServerSelectionError", "MongoNetworkError"];

class DbProxyClient {
    dbProxyFunctionName: string;

    constructor({ dbProxyFunctionName }) {
        this.dbProxyFunctionName = dbProxyFunctionName;
    }

    async runOperation(requestPayload) {
        const Lambda = new LambdaClient({ region: process.env.AWS_REGION });
        const { Payload } = await Lambda.invoke({
            FunctionName: this.dbProxyFunctionName,
            Payload: JSON.stringify({ body: EJSON.stringify(requestPayload) })
        }).promise();

        let parsedPayload;

        try {
            parsedPayload = JSON.parse(Payload as string);
        } catch (e) {
            throw new Error("Could not JSON.parse DB Proxy's response.");
        }

        if (parsedPayload.error) {
            if (MONGO_CONNECTION_ERRORS.includes(parsedPayload.error.name)) {
                throw new Error(
                    `Could not connect to the MongoDB server, make sure the connection string is correct and that the database server allows outside connections. Check https://docs.webiny.com/docs/get-started/quick-start#3-setup-database-connection for more information.`
                );
            }
            throw new Error(`${parsedPayload.error.name}: ${parsedPayload.error.message}`);
        }

        if (!parsedPayload.response) {
            throw new Error(`Missing "response" key in received DB Proxy's response.`);
        }

        const { result } = EJSON.parse(parsedPayload.response);
        return result;
    }
}

class DbProxyDriver {
    client: DbProxyClient;

    constructor({ dbProxyFunctionName = process.env.DB_PROXY_FUNCTION_NAME } = {}) {
        this.client = new DbProxyClient({ dbProxyFunctionName });
    }

    // eslint-disable-next-line
    async save({ name, data, isCreate }) {
        return isCreate ? this.create({ name, data }) : this.update({ name, data });
    }

    async create({ name, data }) {
        await this.client.runOperation({
            collection: this.getCollectionName(name),
            operation: ["insertOne", data]
        });
        return true;
    }

    async update({ name, data }) {
        await this.client.runOperation({
            collection: this.getCollectionName(name),
            operation: ["updateOne", { id: data.id }, { $set: data }]
        });

        return true;
    }

    // eslint-disable-next-line
    async delete({ name, data: { id } }) {
        await this.client.runOperation({
            collection: this.getCollectionName(name),
            operation: ["deleteOne", { id }]
        });
        return true;
    }

    async find({ name, options }) {
        const clonedOptions = { limit: 0, offset: 0, ...options };

        DbProxyDriver.__prepareSearchOption(clonedOptions);

        const results = await this.client.runOperation({
            collection: this.getCollectionName(name),
            operation: [
                "find",
                clonedOptions.query,
                {
                    limit: clonedOptions.limit,
                    sort: clonedOptions.sort,
                    offset: clonedOptions.offset
                }
            ]
        });

        return [!Array.isArray(results) ? [] : results, {}];
    }

    async findOne({ name, options }) {
        const clonedOptions = { ...options };
        DbProxyDriver.__prepareSearchOption(clonedOptions);

        // Get first documents from cursor using each
        const results = await this.client.runOperation({
            collection: this.getCollectionName(name),
            operation: [
                "find",
                clonedOptions.query,
                {
                    limit: 1,
                    sort: clonedOptions.sort
                }
            ]
        });

        return results[0];
    }

    async count({ name, options }) {
        const clonedOptions = { ...options };
        DbProxyDriver.__prepareSearchOption(clonedOptions);

        // Get first documents from cursor using each
        return await this.client.runOperation({
            collection: this.getCollectionName(name),
            operation: ["count", clonedOptions.query]
        });
    }

    getCollectionName(name) {
        return name;
    }

    getClient() {
        return this.client;
    }

    static __prepareSearchOption(options) {
        // Here we handle search (if passed) - we transform received arguments into linked LIKE statements.
        if (options.search && options.search.query) {
            const { query, operator, fields } = options.search;

            const searches = [];
            fields.forEach(field => {
                searches.push({ [field]: { $regex: `.*${query}.*`, $options: "i" } });
            });

            const search = {
                [operator === "and" ? "$and" : "$or"]: searches
            };

            if (options.query instanceof Object) {
                options.query = {
                    $and: [search, options.query]
                };
            } else {
                options.query = search;
            }

            delete options.search;
        }
    }
}

export default DbProxyDriver;
