FROM mhart/alpine-node:12

WORKDIR /app
COPY . .

RUN yarn install