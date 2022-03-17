const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;
const template = require("@babel/template").default;
const babelTypes = require("@babel/types");
const fse = require("fs-extra");
const path = require("path");

let id = 0;

const generateId = () => {
  return `intl${++id}`;
};

function getReplaceExpression(id) {
  const expression = `formatMessage({
              id: messageIds.${id}
          })`;

  const replaceExpression = template.ast(expression).expression;

  return replaceExpression;
}

const localeMap = {};
function saveLocale(id, value) {
  localeMap[id] = value;
}

function addFormatMessage(path) {
  const block = path.findParent((p) => p.isBlockStatement());
  const importAst = template.ast(`const { formatMessage } = useIntl();`);
  if (
    !block.node.body.find((elm) => {
      return (
        babelTypes.isVariableDeclaration(elm) &&
        elm.declarations.find((d) => d.init?.callee?.name === "useIntl")
      );
    })
  ) {
    block.node.body.unshift(importAst);
  }
}

const sourceCode = `
import React from "react";
export default App = () => {
  const aStr = "something";
  const bStr = 'something else';
  return <div>hello world</div>;
};
`;

const ast = parser.parse(sourceCode, {
  sourceType: "unambiguous",
  plugins: ["jsx"],
});

traverse(ast, {
  Program: {
    enter(path) {
      const importIntl = template.ast(`import { useIntl } from 'react-intl'`);
      const importMessage = template.ast(
        `import { messageIds } from 'locale/messages'`
      );
      path.node.body.unshift(importMessage);
      path.node.body.unshift(importIntl);

      path.traverse({
        StringLiteral(path) {
          if (path.findParent((p) => p.isImportDeclaration())) {
            path.node.skipTransform = true;
          }
        },
      });
    },
  },
  StringLiteral(path) {
    if (path.node.skipTransform) {
      return;
    }
    const id = generateId();
    saveLocale(id, path.node.value);
    addFormatMessage(path);
    const replaceExpression = getReplaceExpression(id);
    path.replaceWith(replaceExpression);
    path.skip();
  },
});

const { code } = generate(ast);

const content = `export const resource = ${JSON.stringify(
  localeMap,
  null,
  4
)};\n`;
const messageIdsContent = `
import { resource } from './en-US.js'
function createProxy(obj) {
  const handler = {
    get: function(_, prop) {
      return prop;
    }
  };
  return new Proxy(obj, handler);
}
export const messageIds = createProxy(resource);
`;
fse.writeFileSync("sourceCode.js", code);
fse.writeFileSync("en-US.js", content);
fse.writeFileSync("messageIds.js", messageIdsContent);
