FROM node:20-alpine as base

RUN mkdir /app
WORKDIR /app

ADD package.json package-lock.json ./
RUN npm install --production=false

ADD . .

EXPOSE 3000
VOLUME /app/data

CMD ["npm", "start"]