FROM debian:bullseye

LABEL maintainer="github.com/sunshanpeng"

ENV OPENAI_API_KEY ''

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    apt-utils \
    autoconf \
    automake \
    bash \
    build-essential \
    ca-certificates \
    chromium \
    coreutils \
    curl \
    ffmpeg \
    figlet \
    git \
    gnupg2 \
    jq \
    libgconf-2-4 \
    libtool \
    libxtst6 \
    moreutils \
    python-dev \
    shellcheck \
    sudo \
    tzdata \
    vim \
    wget \
    && apt-get purge --auto-remove \
    && rm -rf /tmp/* /var/lib/apt/lists/*

RUN curl -sL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get update && apt-get install -y --no-install-recommends nodejs \
    && apt-get purge --auto-remove \
    && rm -rf /tmp/* /var/lib/apt/lists/*

WORKDIR /app
COPY package.json /app/
RUN  npm install \
    && rm -fr /tmp/* ~/.npm

COPY index.js /app/

#RUN npm install --registry=https://registry.npm.taobao.org/

ENTRYPOINT [ "node", "index.js" ]