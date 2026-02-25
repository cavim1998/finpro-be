import { App } from "./app.js";

const mainApp = new App();
const app = mainApp.app;

export default app;

if (process.env.NODE_ENV !== "production") {
  const port = process.env.PORT || 8000;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}
