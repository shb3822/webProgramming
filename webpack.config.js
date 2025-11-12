// webpack.config.js
const path = require('path');

module.exports = {
  mode: 'development', // 개발용: 'production'으로 바꾸면 최적화됨
  entry: './src/index.js', // 진입점 (src 폴더 안에 있어야 함)
  output: {
    path: path.resolve(__dirname, 'dist'), // 결과물 경로
    filename: 'main.js', // 출력 파일 이름
  },
};
