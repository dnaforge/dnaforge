const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');
const webpack = require('webpack');


module.exports = merge(common, {
    mode: "test",
    devtool: 'inline-source-map',
    devServer: {
        static: './dist',
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
