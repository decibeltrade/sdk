/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow use of getAccountResource function",
    },
    messages: {
      forbidden: "Calling `getAccountResource` is not allowed.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;

        if (
          (callee.type === "Identifier" && callee.name === "getAccountResource") ||
          (callee.type === "MemberExpression" &&
            callee.property?.type === "Identifier" &&
            callee.property.name === "getAccountResource")
        ) {
          context.report({ node, messageId: "forbidden" });
        }
      },
    };
  },
};
