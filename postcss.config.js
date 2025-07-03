module.exports = {
  plugins: [
    require('autoprefixer'),
    require('cssnano')({
      preset: [
        'default',
        {
          discardComments: {
            removeAll: true,
          },
          // Optimize font loading
          minifyFontValues: true,
          // Optimize animations
          reduceIdents: true,
          // Merge longhand properties
          mergeRules: true,
          // Remove unused CSS at-rules
          discardUnused: true,
          // Normalize display values
          normalizeDisplayValues: true,
        },
      ],
    }),
  ],
};