const CopyPlugin = require("copy-webpack-plugin");
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const webpack = require('webpack');

module.exports = merge(common, {
    mode: 'production',
    plugins: [
        new webpack.DefinePlugin({
            'process.env': {
                PRODUCTION: JSON.stringify(true),
            }
        }),
        new CopyPlugin({
            patterns: [
                { from: "./CNAME", to: "." },
            ],
        }),
    ],
    optimization: {
        runtimeChunk: 'single',
    },
});