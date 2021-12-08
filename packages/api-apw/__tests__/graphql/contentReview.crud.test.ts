import { useContentGqlHandler } from "../utils/useContentGqlHandler";
import { ApwContentReviewStepStatus } from "~/types";
import { createSetupForContentReview } from "../utils/helpers";

describe("Content Review crud test", () => {
    const options = {
        path: "manage/en-US"
    };

    const gqlHandler = useContentGqlHandler({
        ...options
    });
    const {
        getContentReviewQuery,
        createContentReviewMutation,
        deleteContentReviewMutation,
        listContentReviewsQuery,
        updateContentReviewMutation
    } = gqlHandler;

    const setup = async () => {
        return createSetupForContentReview(gqlHandler);
    };

    test(`should able to create, update, get, list and delete "Content Review"`, async () => {
        const { page, workflow } = await setup();

        /*
         Should return error in case of no entry found.
        */
        const [getContentReviewResponse] = await getContentReviewQuery({ id: "123" });
        expect(getContentReviewResponse).toEqual({
            data: {
                advancedPublishingWorkflow: {
                    getContentReview: {
                        data: null,
                        error: {
                            code: "NOT_FOUND",
                            data: null,
                            message: "Entry not found!"
                        }
                    }
                }
            }
        });
        /*
         Create a content review entry.
        */
        const [createContentReviewResponse] = await createContentReviewMutation({
            data: {
                content: {
                    id: page.id,
                    type: "page"
                }
            }
        });

        const createdContentReview =
            createContentReviewResponse.data.advancedPublishingWorkflow.createContentReview.data;

        expect(createContentReviewResponse).toEqual({
            data: {
                advancedPublishingWorkflow: {
                    createContentReview: {
                        data: {
                            id: expect.any(String),
                            createdOn: expect.stringMatching(/^20/),
                            savedOn: expect.stringMatching(/^20/),
                            createdBy: {
                                id: "12345678",
                                displayName: "John Doe",
                                type: "admin"
                            },
                            steps: workflow.steps.map(() => ({
                                status: ApwContentReviewStepStatus.INACTIVE,
                                slug: expect.any(String),
                                pendingChangeRequests: 0
                            })),
                            content: {
                                id: expect.any(String),
                                type: expect.any(String),
                                settings: null
                            }
                        },
                        error: null
                    }
                }
            }
        });
        /*
         Now that we have a content review entry, we should be able to get it
        */
        const [getContentReviewByIdResponse] = await getContentReviewQuery({
            id: createdContentReview.id
        });
        expect(getContentReviewByIdResponse).toEqual({
            data: {
                advancedPublishingWorkflow: {
                    getContentReview: {
                        data: {
                            id: expect.any(String),
                            createdOn: expect.stringMatching(/^20/),
                            savedOn: expect.stringMatching(/^20/),
                            createdBy: {
                                id: "12345678",
                                displayName: "John Doe",
                                type: "admin"
                            },
                            steps: workflow.steps.map(() => ({
                                status: ApwContentReviewStepStatus.INACTIVE,
                                slug: expect.any(String),
                                pendingChangeRequests: 0
                            })),
                            content: {
                                id: expect.any(String),
                                type: expect.any(String),
                                settings: null
                            }
                        },
                        error: null
                    }
                }
            }
        });

        /*
         Let's update the entry with some change requested
        */
        const [updateContentReviewResponse] = await updateContentReviewMutation({
            id: createdContentReview.id,
            data: {}
        });

        expect(updateContentReviewResponse).toEqual({
            data: {
                advancedPublishingWorkflow: {
                    updateContentReview: {
                        data: {
                            id: expect.any(String),
                            createdOn: expect.stringMatching(/^20/),
                            savedOn: expect.stringMatching(/^20/),
                            createdBy: {
                                id: "12345678",
                                displayName: "John Doe",
                                type: "admin"
                            },
                            steps: workflow.steps.map(() => ({
                                status: ApwContentReviewStepStatus.INACTIVE,
                                slug: expect.any(String),
                                pendingChangeRequests: 0
                            })),
                            content: {
                                id: expect.any(String),
                                type: expect.any(String),
                                settings: null
                            }
                        },
                        error: null
                    }
                }
            }
        });

        /*
         Let's list all workflow entries there should be only one
        */
        const [listContentReviewsResponse] = await listContentReviewsQuery({ where: {} });
        expect(listContentReviewsResponse).toEqual({
            data: {
                advancedPublishingWorkflow: {
                    listContentReviews: {
                        data: [
                            {
                                id: expect.any(String),
                                createdOn: expect.stringMatching(/^20/),
                                savedOn: expect.stringMatching(/^20/),
                                createdBy: {
                                    id: "12345678",
                                    displayName: "John Doe",
                                    type: "admin"
                                },
                                steps: workflow.steps.map(() => ({
                                    status: ApwContentReviewStepStatus.INACTIVE,
                                    slug: expect.any(String),
                                    pendingChangeRequests: 0
                                })),
                                content: {
                                    id: expect.any(String),
                                    type: expect.any(String),
                                    settings: null
                                }
                            }
                        ],
                        error: null,
                        meta: {
                            hasMoreItems: false,
                            totalCount: 1,
                            cursor: null
                        }
                    }
                }
            }
        });

        /*
         Delete the only entry we have
        */
        const [deleteContentReviewResponse] = await deleteContentReviewMutation({
            id: createdContentReview.id
        });
        expect(deleteContentReviewResponse).toEqual({
            data: {
                advancedPublishingWorkflow: {
                    deleteContentReview: {
                        data: true,
                        error: null
                    }
                }
            }
        });

        /*
         Now that we've deleted the only entry we had, we should get empty list as response from "listWorkflows"
        */
        const [listContentReviewsAgainResponse] = await listContentReviewsQuery({ where: {} });
        expect(listContentReviewsAgainResponse).toEqual({
            data: {
                advancedPublishingWorkflow: {
                    listContentReviews: {
                        data: [],
                        error: null,
                        meta: {
                            hasMoreItems: false,
                            totalCount: 0,
                            cursor: null
                        }
                    }
                }
            }
        });
    });
});
