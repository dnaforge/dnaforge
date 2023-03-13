const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');


module.exports = {
    entry: './src/scripts/index.ts',
    output: {
        filename: 'main.js',
        path: path.resolve(__dirname, 'dist'),
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.css$/i,
                use: ['style-loader', 'css-loader'],
            },

            {
                test: /\.py|\.obj|\.ico/,
                type: 'asset/source'
            },

            {
                test: /\.htm$/i,
                loader: "html-loader",
            },
        ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: "DNA Forge",
            template: "src/html/index.html",
            favicon: "./favicon2.png",

            templateParameters: {
                gitAddress: "https://version.aalto.fi/gitlab/orponen/ncgroup",
                docsAddress: "https://version.aalto.fi/gitlab/orponen/ncgroup",
                examplesAddress: "https://version.aalto.fi/gitlab/orponen/ncgroup",
                emailAddress: "https://version.aalto.fi/gitlab/orponen/ncgroup",
            },
        }),
    ],

    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
    },
    optimization: {
        runtimeChunk: 'single',
    },
}
    ; 
