FROM mcr.microsoft.com/devcontainers/base:ubuntu-22.04

ARG SONIC_PI_BRANCH=stable
ARG SONIC_PI_DIR=/opt/sonic-pi

# Avoid interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive
# Ensure UTF-8 locale for Elixir (avoids latin1 warnings during Tau build)
ENV LANG=C.UTF-8
ENV ELIXIR_ERL_OPTIONS="+fnu"

# ── System dependencies ──────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Build tools
    build-essential cmake ninja-build pkg-config git curl \
    # Ruby 3.1 build dependencies are in a separate step below
    software-properties-common \
    # SuperCollider server (headless, no GUI)
    supercollider-server sc3-plugins-server \
    # Audio stack
    jackd2 libjack-jackd2-dev pulseaudio pulseaudio-utils \
    # SSL and other libs
    libssl-dev libaubio-dev libfftw3-dev \
    # Audio encoding for streaming
    ffmpeg \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# ── Ruby 3.1 (Sonic Pi v4.6 requires --yjit, available from Ruby 3.1+) ──
# The Brightbox PPA no longer publishes for jammy; build Ruby 3.1 from source.
RUN apt-get update && apt-get install -y --no-install-recommends \
      autoconf bison libgdbm-dev libncurses5-dev libreadline-dev libffi-dev libyaml-dev zlib1g-dev \
    && curl -fsSL https://cache.ruby-lang.org/pub/ruby/3.1/ruby-3.1.6.tar.gz -o /tmp/ruby.tar.gz \
    && mkdir -p /tmp/ruby-src && tar -xzf /tmp/ruby.tar.gz -C /tmp/ruby-src --strip-components=1 \
    && cd /tmp/ruby-src \
    && ./configure --prefix=/usr/local --enable-yjit --disable-install-doc \
    && make -j"$(nproc)" \
    && make install \
    && rm -rf /tmp/ruby.tar.gz /tmp/ruby-src \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# ── Erlang OTP 26 (Sonic Pi's Tau needs :public_key.cacerts_get/0, OTP 25+) ──
# Build from source for architecture independence and reliability.
RUN OTP_VERSION=26.2.5.6 \
    && curl -fsSL "https://github.com/erlang/otp/releases/download/OTP-${OTP_VERSION}/otp_src_${OTP_VERSION}.tar.gz" -o /tmp/otp.tar.gz \
    && mkdir -p /tmp/otp-src && tar -xzf /tmp/otp.tar.gz -C /tmp/otp-src --strip-components=1 \
    && cd /tmp/otp-src \
    && ./configure --prefix=/usr/local \
       --without-javac --without-wx --without-debugger --without-observer \
       --without-et --without-megaco --without-odbc \
    && make -j"$(nproc)" \
    && make install \
    && rm -rf /tmp/otp.tar.gz /tmp/otp-src

# ── Elixir 1.17 (Tau requires >= 1.14; compiled for OTP 26) ─────────
RUN curl -fsSL https://github.com/elixir-lang/elixir/releases/download/v1.17.3/elixir-otp-26.zip \
      -o /tmp/elixir.zip \
    && mkdir -p /usr/local/elixir \
    && unzip -q /tmp/elixir.zip -d /usr/local/elixir \
    && ln -sf /usr/local/elixir/bin/elixir /usr/local/bin/elixir \
    && ln -sf /usr/local/elixir/bin/mix /usr/local/bin/mix \
    && ln -sf /usr/local/elixir/bin/iex /usr/local/bin/iex \
    && rm /tmp/elixir.zip

# ── Build Sonic Pi server (no GUI) ──────────────────────────────────
RUN git clone --depth 1 --branch ${SONIC_PI_BRANCH} \
      https://github.com/sonic-pi-net/sonic-pi.git ${SONIC_PI_DIR}

WORKDIR ${SONIC_PI_DIR}/app

# Patch the build script to skip GUI components
RUN sed -i 's|"${SCRIPT_DIR}"/linux-config.sh|# "${SCRIPT_DIR}"/linux-config.sh|' linux-build-all.sh \
    && sed -i 's|"${SCRIPT_DIR}"/linux-build-gui.sh|# "${SCRIPT_DIR}"/linux-build-gui.sh|' linux-build-all.sh

RUN ./linux-build-all.sh --system-libs

WORKDIR /

# ── PulseAudio config for headless operation ─────────────────────────
RUN mkdir -p /etc/pulse
COPY pulse-default.pa /etc/pulse/default.pa

# ── Audio startup script ─────────────────────────────────────────────
COPY start-audio.sh /usr/local/bin/start-audio.sh
RUN chmod +x /usr/local/bin/start-audio.sh

# ── Log directories needed by Sonic Pi daemon ───────────────────────
RUN mkdir -p ${SONIC_PI_DIR}/.sonic-pi/log \
    && chmod -R 775 ${SONIC_PI_DIR}/.sonic-pi

ENV SONIC_PI_HOME=${SONIC_PI_DIR}
