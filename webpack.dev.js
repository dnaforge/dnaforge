const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const webpack = require('webpack');


module.exports = merge(common, {
    mode: "development",
    devtool: 'inline-source-map',
    devServer: {
        port: 8081,
        static: './dist',
        client: {
            overlay: {
                errors: true,
                warnings: false,
                runtimeErrors: false,
            },
        },
    },
    plugins: [
        new webpack.DefinePlugin({
            'process.env': {
                PRODUCTION: JSON.stringify(false),
            },
        }),
    ],
    optimization: {
        runtimeChunk: 'single',
    },
}); 
