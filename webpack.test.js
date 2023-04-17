const path = require('path');
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const webpack = require('webpack');


module.exports = merge(common, {
    mode: "production",
    entry: './src/test/test.ts',
    devServer: {
        static: './dist',
    },
    plugins: [
        new webpack.DefinePlugin({
            'process.env': {
                PRODUCTION: JSON.stringify(false),
            }
        }),
    ],
    optimization: {
    },

}); 
