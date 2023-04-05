const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const childProcess = require('child_process');
const PACKAGE = require('./package.json');

const __versionString__ = PACKAGE.version + childProcess.execSync('git rev-list HEAD --count').toString();

module.exports = {
    entry: './src/scripts/index.ts',
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
            favicon: "./favicon.png",

            templateParameters: {
                gitAddress: "https://github.com/Ritkuli/dnaforge",
                docsAddress: "https://github.com/Ritkuli/dnaforge/tree/main/docs",
                examplesAddress: "https://version.aalto.fi/gitlab/orponen/ncgroup",
                emailAddress: "https://version.aalto.fi/gitlab/orponen/ncgroup",
            },
        }),
        new webpack.DefinePlugin({
            "process.env.__VERSION__": JSON.stringify(__versionString__) 
        })
    ],

    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
    },
}; 
