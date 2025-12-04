/** @type {import("eslint").Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow use of globalPerpEngineState function",
    },
    messages: {
      forbidden: "Calling `globalPerpEngineState` is not allowed.",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;

        if (
          (callee.type === "Identifier" && callee.name === "globalPerpEngineState") ||
          (callee.type === "MemberExpression" &&
            callee.property?.type === "Identifier" &&
            callee.property.name === "globalPerpEngineState")
        ) {
          context.report({ node, messageId: "forbidden" });
        }
      },
    };
  },
};
