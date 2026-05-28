FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY server.js contextMerge.js contextHelpers.js coachContextLimits.js coachGeneralKnowledge.js trainingSignals.js coachTemplate.js coachCatalogCache.js ./

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
