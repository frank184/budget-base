FROM node:25-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY data ./data

EXPOSE 3001

CMD ["npm", "run", "dev"]
