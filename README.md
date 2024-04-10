# venn-isomorphic

**Quick and dirty solution.**

Wrapper for [upsetjs/venn.js](https://github.com/upsetjs/venn.js) to be able to run it on the
server.

Code structure taken from [mermaid-isomorphic](https://github.com/remcohaszing/mermaid-isomorphic).

## Notes

- At first [I tried to do it with JSDOM](https://github.com/stereobooster/venn-nodejs). It doesn't
  work, because it needs `getComputedTextLength` for layout.
- Algorithm is not stable, so tests doesn't work (svg output everytime is different)
- Not exposed: `wrap`, `useViewBox`, `width`, `height`, `padding`, `colours`, `colors`, `fontSize`,
  `normalize`, `layoutFunction`, `scaleToFit`, `styled`, `round`, `distinct`, `orientation`,
  `orientationOrder`, `lossFunction`
