// previewjs.config.js
import React from "react";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import store from "./src/store"; // 실제 store 경로로 수정

export default {
  wrapper: ({ children }) => (
    <Provider store={store}>
      <BrowserRouter>{children}</BrowserRouter>
    </Provider>
  ),
};