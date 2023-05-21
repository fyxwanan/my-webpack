# 实现一个自己的打包工具

1、Esmodule

```js
import axios from 'axios';

export default axios;
```

## 概览

1、找到一个入口文件
2、解析这个入口文件，提取它的依赖
3、解析入口文件依赖的依赖，递归的去创建一个文件间的依赖图，描述所有文件的依赖关系
4、把所有文件打包成一个文件夹


## 开始开发

1. 新建几个js源文件

* name.js
* message.js
* entry.js

2. 肉眼观察三个文件的依赖关系

entry 依赖 message, message 依赖 name

entry.js -> message.js -> name.js


3. 开始编写自己的打包工具 mywebpack.js

```js
const fs = require('fs');

function createAsset(filename) {
  const content = fs.readFileSync(filename, 'utf-8');

  console.log('content ==>', content)

}

createAsset('./source/entry.js')
```


4. 分析ast，思考如何能够解析出entry的依赖

4.1 File -> Program
4.2 Program -> body 里面是我们各种语法的描述
4.3 body -> ImportDeclaration 引入的声明
4.4 ImportDeclaration source属性， source.value就是引入文件的地址 './message.js'


5. 生成entry.js 的ast

babylon 一个基于Babel的js解析工具

```js
const fs = require('fs');
const babylon = require('babylon');

function createAsset(filename) {
  const content = fs.readFileSync(filename, 'utf-8');

  const ast = babylon.parse(content, {
    sourceType: 'module'
  })

  console.log('content ==>', ast)

}

createAsset('./source/entry.js')
```

6. 基于AST，找到entry.js的 ImportDeclaration Node
babel-traverse 这个工具包可以遍历 ast语法树

```js
const fs = require('fs');
const babylon = require('babylon');
const traverse = require('babel-traverse').default;

function createAsset(filename) {
  const content = fs.readFileSync(filename, 'utf-8');

  const ast = babylon.parse(content, {
    sourceType: 'module'
  })

  traverse(ast, {
    ImportDeclaration: ({ node }) => {
      console.log('node ===>', node)
    }
  })

  // console.log('content ==>', ast)

}

createAsset('./source/entry.js')
```

7. 获取entry.js的依赖
``` js
const fs = require('fs');
const babylon = require('babylon');
const traverse = require('babel-traverse').default;

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
  
  console.log('dependencies ===>', dependencies)

}

createAsset('./source/entry.js')
```


8. 优化createAsset，使其能够区分文件

因为要获取所有文件的依赖，所有需要有一个Id来表示所有的文件

用一个自增的number，这样遍历的每个文件id就是唯一的了

先获取到entry.js的id filename 以及 dependencies

```js
const fs = require('fs');
const babylon = require('babylon');
const traverse = require('babel-traverse').default;

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

  return {
    id,
    filename,
    dependencies,
  }

}

const mainAsset = createAsset('./source/entry.js')

console.log('mainAsset ===>', mainAsset)
```

9. 获取到单个文件的依赖了，建立依赖图

新增一个函数 createGraph, 把createAsset调用移入creatGraph
```js
function createGraph(entry) {
  const mainAsset = createAsset(entry)
  return mainAsset;
}

const graph = createGraph('./source/entry.js')

console.log('graph ===>', graph)
```

10. 上面存储的路径都是相对路径，想办法把他们转为绝对路径

有了绝对路径，我们才可以获取到各个文件的asset
```js
function createGraph(entry) {
  const mainAsset = createAsset(entry);
  const allAsset = [mainAsset];

  for(let asset of allAsset) {
    const dirname = path.dirname(asset.filename);

    asset.dependencies.forEach(relativePath => {
      const absolutePath = path.join(dirname, relativePath);

      const childAsset = createAsset(absolutePath);
    })
  }

}
```

11. 我们需要一个map, 记录depend中的相对路径 和 childAsset的对应关系

因为我们后面需要做依赖的引入，需要一个对应的关系
```js
function createGraph(entry) {
  const mainAsset = createAsset(entry);
  const allAsset = [mainAsset];

  for(let asset of allAsset) {
    const dirname = path.dirname(asset.filename);
    asset.mapping = {};

    asset.dependencies.forEach(relativePath => {
      const absolutePath = path.join(dirname, relativePath);

      const childAsset = createAsset(absolutePath);

      asset.mapping[relativePath] = childAsset.id;
    })
  }

}

```


12. 开始遍历所有文件
```js
function createGraph(entry) {
  const mainAsset = createAsset(entry);
  const allAsset = [mainAsset];

  for(let asset of allAsset) {
    const dirname = path.dirname(asset.filename);
    asset.mapping = {};
    asset.dependencies.forEach(relativePath => {
      const absolutePath = path.join(dirname, relativePath);

      const childAsset = createAsset(absolutePath);

      asset.mapping[relativePath] = childAsset.id;

      allAsset.push(childAsset);
    })
  }

  return allAsset;

}

```

这个输出就是我们一直提到的依赖图！！！


13. 新增一个方法bundle
```js
function bundle(graph) {

}

const graph = createGraph('./source/entry.js')
const result = bundle(graph);
```


14. 创建整体的结果代码

因为最后打包出来的东西需要接受一个参数，且需要立即执行，所以用一个自执行函数来包裹

自执行函数接收参数是？是module, 是每一个文件模块

```js
function bundle(graph) {
   let modules = '';

   graph.forEach(module => {
    modules += `${module.id}: [

    ],`
   })

   const result = `
      (function(){

      })({${modules}})
   `
}
```


15. 编译源代码
```js
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
```

16. 把编译后的代码，加入到咱们得result中

1. module变量代表当前模块

这个变量是一个对象，它的exports属性是对外的接口，module.exports，加载某个模块，其实就是加载该模块的module.exports属性

2. require 用于加载模块