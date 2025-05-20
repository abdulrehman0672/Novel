import app from './app';




const port = config.PORT || 5000;
const server = app.listen(port, () => {
  console.log(`App running on port ${port}...`);
});

