/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow use of globalAccountsState function",
    },
    messages: {
      forbidden: "Calling `globalAccountsState` is not allowed.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;

        if (
          (callee.type === "Identifier" && callee.name === "globalAccountsState") ||
          (callee.type === "MemberExpression" &&
            callee.property?.type === "Identifier" &&
            callee.property.name === "globalAccountsState")
        ) {
          context.report({ node, messageId: "forbidden" });
        }
      },
    };
  },
};
