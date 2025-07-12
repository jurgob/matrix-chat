# Matrix chat example

## Getting Started

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

## Building for Production

Create a production build:

```bash
npm run build
```

## Deployment

### Docker Deployment

To build and run using Docker:

```bash
docker build -t my-app .

# Run the container
docker run -p 3000:3000 my-app
```

The containerized application can be deployed to any platform that supports Docker, including:

- Fly.io
- Railway


## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever CSS framework you prefer.

---

Built with ❤️ using React Router.
