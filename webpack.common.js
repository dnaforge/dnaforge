const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const childProcess = require('child_process');
const PACKAGE = require('./package.json');

const date = new Date();
const versionSuffix = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate() + 1].join(".");
const __buildTime__ = date.toISOString();
const __versionString__ = PACKAGE.version + "." + versionSuffix;// + childProcess.execSync('git rev-list HEAD --count').toString().trim();

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
            title: "DNAforge",
            template: "src/html/index.html",
            favicon: "./favicon.png",

            templateParameters: {
                gitAddress: "https://github.com/dnaforge/dnaforge",
                docsAddress: "https://github.com/dnaforge/dnaforge/tree/main/docs",
                examplesAddress: "https://github.com/dnaforge/dnaforge/tree/main/docs/examples",
                userGuideAddress: "https://github.com/dnaforge/dnaforge/tree/main/docs/user-guide",
                emailAddress: "https://version.aalto.fi/gitlab/orponen/ncgroup",
                version: __versionString__,
            },
        }),
        new webpack.DefinePlugin({
            "process.env.__VERSION__": JSON.stringify(__versionString__),
            "process.env.__BUILDTIME__": JSON.stringify(__buildTime__),
        })
    ],

    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
    },
}; 
