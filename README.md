# Matrix chat example

## demo

go to this url: 


## Contributing

### Installation

Install the dependencies:

```bash
npm install
```

### Development


Start the development server with HMR:

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`.


OR, you you whant to use 2 different terminl run those commandd: 

terminal 1: 

```bash
npm run dev:docker
```

terminal 2: 

```bash
npm run dev:app
```

#### Check types

```bash
npm run typecheck
```


## Building for Production

Create a production build:

```bash
npm run build
```

## Deployment

This app is hosted by fly.io 

deploy the matrix server

```bash
npm run deploy:matrixserver
```

deploy app: 

```bash
npm run deploy
```

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever CSS framework you prefer.

---

Built with ❤️ using React Router.
