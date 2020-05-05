import { Context as APIContext, ContextPlugin } from "@webiny/graphql/types";
import acceptLanguageParser from "accept-language-parser";
import { Context as I18NContext, ContextI18NGetLocales } from "@webiny/api-i18n/types";

const plugin: ContextPlugin<APIContext & I18NContext> = {
    type: "context",
    name: "context-i18n",
    apply: async context => {
        const locales = context.plugins.byName<ContextI18NGetLocales>("context-i18n-get-locales");

        if (!locales) {
            throw new Error('Cannot load locales - missing "context-i18n-get-locales" plugin.');
        }

        const { isColdStart, event } = context;

        const self = {
            __i18n: {
                acceptLanguage: null,
                defaultLocale: null,
                locale: null,
                // NOTE: if `isColdStart!==false`, we can't run queries against our API because Apollo Gateway hasn't yet
                // built it's federated schema and we will end up in an infinite-loop.
                locales: isColdStart !== false ? [] : await locales.resolve({ context })
            },
            getDefaultLocale() {
                const allLocales = self.getLocales();
                return allLocales.find(item => item.default === true);
            },
            getLocale() {
                if (self.__i18n.locale) {
                    return self.__i18n.locale;
                }

                if (isColdStart !== false) {
                    return null;
                }

                const allLocales = self.getLocales();
                const acceptLanguage = acceptLanguageParser.pick(
                    allLocales.map(item => item.code),
                    event ? event.headers["accept-language"] : null
                );

                let currentLocale;
                if (acceptLanguage) {
                    currentLocale = allLocales.find(item => item.code === acceptLanguage);
                }

                if (!currentLocale) {
                    currentLocale = self.getDefaultLocale();
                }

                self.__i18n.locale = currentLocale;
                return self.__i18n.locale;
            },
            getLocales() {
                return self.__i18n.locales;
            },
            getValue(value) {
                if (!value) {
                    return "";
                }

                if (Array.isArray(value.values)) {
                    const locale = self.getLocale();
                    if (!locale) {
                        return "";
                    }

                    const valuesValue = value.values.find(value => value.locale === locale.id);
                    return valuesValue ? valuesValue.value : "";
                }

                return value.value || "";
            }
        };

        context.i18n = self;
    }
};

export default plugin;
