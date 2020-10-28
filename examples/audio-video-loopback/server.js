'use strict';

const { PassThrough } = require('stream')
const fs = require('fs')

const { RTCAudioSink, RTCVideoSink } = require('wrtc').nonstandard;

const { StreamInput } = require('fluent-ffmpeg-multistream')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
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
      // console.log(stream.audio)
    }
  };

  stream.audio.on('end', () => {
    audioSink.removeEventListener('data', onAudioData);
  });

  stream.audio.on('data',function(chunk){
    console.log(chunk)
  });

  stream.proc = ffmpeg().addInput((new StreamInput(stream.audio)).url)
  .addInputOptions([
    '-f s16le',
    '-ar 48k',
    '-ac 1',
  ])
  .on('start', ()=>{
    console.log('Start recording >> ', stream.recordPath)
  })
  .on('end', ()=>{
    stream.recordEnd = true;
    console.log('Stop recording >> ', stream.recordPath)
  })
  .output(stream.recordPath);

  stream.proc.run();

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
