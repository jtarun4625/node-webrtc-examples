'use strict';

const { PassThrough } = require('stream')
const fs = require('fs')

const { RTCAudioSink, RTCVideoSink } = require('wrtc').nonstandard;

const { StreamInput } = require('fluent-ffmpeg-multistream')

function beforeOffer(peerConnection) {
  const audioTransceiver = peerConnection.addTransceiver('audio');
  const videoTransceiver = peerConnection.addTransceiver('video');
  const stream = {
    recordPath: 'test'+ '.mp4',
    audio: new PassThrough()
  };

  const audioSink = new RTCAudioSink(audioTransceiver.receiver.track);


  const onAudioData = ({ samples: { buffer } }) => {
    if (!stream.end) {
      stream.audio.push(Buffer.from(buffer));
      console.log(stream.audio)

    }
  };

  audioSink.addEventListener('data', onAudioData);


  stream.audio.on('end', () => {
    audioSink.removeEventListener('data', onAudioData);
  });
  console.log(stream.audio)
  console.log((new StreamInput(stream.audio)))


  return Promise.all([
    audioTransceiver.sender.replaceTrack(audioTransceiver.receiver.track),
    videoTransceiver.sender.replaceTrack(videoTransceiver.receiver.track)
  ]);
}



module.exports = { beforeOffer };
