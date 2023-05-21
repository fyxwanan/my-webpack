// 1、找到一个入口文件
// 2、解析这个入口文件，提起它的依赖
// 3、解析入口文件依赖的依赖，递归的去创建一个文件间的依赖图，描述所有文件的依赖关系
// 4、把所有文件打包成一个文件夹

const fs = require('fs');
// 生成ast树
const babylon = require('babylon');
const traverse = require('babel-traverse').default;

const path = require('path');
// 转化成es5代码
const babelCore = require('babel-core');
const babelPresetEnv = require('babel-preset-env');
// const highlight = require("highlight").Highlight;


let ID = 0;

function createAsset(filename) {
  const content = fs.readFileSync(filename, 'utf-8');

  const ast = babylon.parse(content, {
    sourceType: 'module'
  })

  const dependencies = [];

  traverse(ast, {
    ImportDeclaration: ({ node }) => {
      
      dependencies.push(node.source.value);
      
    }
  })

  const id = ID++;

  // 创建babel源代码
  const { code } = babelCore.transformFromAst(ast, null, {
    presets: ['env']
  });

  return {
    id,
    filename,
    dependencies,
    code,
  }

}

function createGraph(entry) {
  const mainAsset = createAsset(entry);
  const allAsset = [mainAsset];

  for(let asset of allAsset) {
    const dirname = path.dirname(asset.filename);
    asset.mapping = {};
    asset.dependencies.forEach(relativePath => {
      const absolutePath = path.join(dirname, relativePath);
      const childAsset = createAsset(`${absolutePath}.js`);

      asset.mapping[relativePath] = childAsset.id;

      allAsset.push(childAsset);
    })
  }

  return allAsset;

}

function bundle(graph) {
   let modules = '';

   graph.forEach(module => {
    modules += `${module.id}: [
      function(require, module, exports) {
        ${module.code}
      },
      ${JSON.stringify(module.mapping)},
    ],`
   })

  //  实现require 方法 
   const result = `
      (function(modules){
        function require(id) {
          const [fn, mapping]= modules[id];

          function localRequire(relativePath) {
            return require(mapping[relativePath])
          }

          const module = { exports: {} };

          fn(localRequire, module, module.exports);

          return module.exports;
        }
        require(0)
      })({${modules}})
   `

   return result;
}

const graph = createGraph('./source/entry.js')

const result = bundle(graph);

console.log(result)




