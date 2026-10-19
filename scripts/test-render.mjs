import React from 'react';
import { renderToString } from 'react-dom/server';

async function test() {
  try {
    const AppMod = await import('../src/App.js');
    const App = AppMod.default;
    const html = renderToString(React.createElement(App));
    console.log('RENDER SUCCESSFUL! Length:', html.length);
  } catch (err) {
    console.error('RENDER ERROR CAUGHT:', err);
  }
}

test();
