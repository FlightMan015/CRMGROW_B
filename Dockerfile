FROM ubuntu:16.04

RUN apt-get update && apt-get install -y openssh-server curl dirmngr apt-transport-https lsb-release ca-certificates ffmpeg gcc g++ make
RUN mkdir /var/run/sshd
RUN echo 'root:THEPASSWORDYOUCREATED' | chpasswd
RUN sed -i 's/PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config

# SSH login fix. Otherwise user is kicked off after login
RUN sed 's@session\s*required\s*pam_loginuid.so@session optional pam_loginuid.so@g' -i /etc/pam.d/sshd

ENV NOTVISIBLE "in users profile"
RUN echo "export VISIBLE=now" >> /etc/profile

# Grab Node12
RUN curl -sL https://deb.nodesource.com/setup_12.x |  bash -
RUN apt -y install nodejs

#do Node stuff
RUN mkdir -p /home/node/app/node_modules 
# this was removed && chown -R node:node /home/node/app

WORKDIR /home/node/app

COPY  . .

# USER node

RUN npm install



EXPOSE 3000 22
# CMD ["./dockerCMD.sh"] test
CMD /usr/sbin/sshd && npm run start
