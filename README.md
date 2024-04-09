# venn-isomorphic

**Quick and dirty solution.**

Wrapper for [upsetjs/venn.js](https://github.com/upsetjs/venn.js) to be able to run it on the
server.

Code structure taken from https://github.com/remcohaszing/mermaid-isomorphic

## Notes

- Algorithm is not stable, so tests doesn't work
- Not exposed: `wrap`, `useViewBox`, `width`, `height`, `padding`, `colours`, `colors`, `fontSize`,
  `normalize`, `layoutFunction`, `scaleToFit`, `styled`, `round`, `distinct`, `orientation`,
  `orientationOrder`, `lossFunction`
