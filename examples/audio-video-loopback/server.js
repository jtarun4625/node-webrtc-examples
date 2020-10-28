'use strict';

const { PassThrough } = require('stream')
const fs = require('fs')

const { RTCAudioSink, RTCVideoSink } = require('wrtc').nonstandard;

const { StreamInput } = require('fluent-ffmpeg-multistream')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const VIDEO_OUTPUT_FILE = './recording.mp4'

ffmpeg.setFfmpegPath(ffmpegPath);
function beforeOffer(peerConnection) {
  const audioTransceiver = peerConnection.addTransceiver('audio');
  const videoTransceiver = peerConnection.addTransceiver('video');
  const stream = {
    recordPath: 'test'+ '.mp4',
    audio: new PassThrough()
  };

  const audioSink = new RTCAudioSink(audioTransceiver.receiver.track);
  const streams = [];


  const onAudioData = ({ samples: { buffer } }) => {
    if (!stream.end) {
      stream.audio.push(Buffer.from(buffer));
      // console.log(stream.audio)
    }
  };

  audioSink.addEventListener('data', onAudioData);

  streams.unshift(stream);

  streams.forEach(item=>{
    if (item !== stream && !item.end) {
      item.end = true;
      if (item.audio) {
        item.audio.end();
      }
    }
  });

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



  stream.audio.on('end', () => {
    audioSink.removeEventListener('data', onAudioData);
  });


  const { close } = peerConnection;
  peerConnection.close = function() {
    audioSink.stop();
    // videoSink.stop();

    streams.forEach(({ audio, video, end, proc, recordPath })=>{
      if (!end) {
        if (audio) {
          audio.end();
        }
        video.end();
      }
    });

    let totalEnd = 0;
    const timer = setInterval(()=>{
      streams.forEach(stream=>{
        if (stream.recordEnd) {
          totalEnd++;
          if (totalEnd === streams.length) {
            clearTimeout(timer);

            const mergeProc = ffmpeg()
              .on('start', ()=>{
                console.log('Start merging into ' + VIDEO_OUTPUT_FILE);
              })
              .on('end', ()=>{
                streams.forEach(({ recordPath })=>{
                  fs.unlinkSync(recordPath);
                })
                console.log('Merge end. You can play ' + VIDEO_OUTPUT_FILE);
              });
        
            streams.forEach(({ recordPath })=>{
              mergeProc.addInput(recordPath)
            });
        
            mergeProc
              .output(VIDEO_OUTPUT_FILE)
              .run();
          }
        }
      });
    }, 1000)

    return close.apply(this, arguments);
  }


  return Promise.all([
    audioTransceiver.sender.replaceTrack(audioTransceiver.receiver.track),
    videoTransceiver.sender.replaceTrack(videoTransceiver.receiver.track)
  ]);
}





module.exports = { beforeOffer };
