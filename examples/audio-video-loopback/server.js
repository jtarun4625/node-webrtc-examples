'use strict';

const { PassThrough, finished } = require('stream')
const fs = require('fs')

const { RTCAudioSink, RTCVideoSink } = require('wrtc').nonstandard;

const { StreamInput } = require('fluent-ffmpeg-multistream')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const VIDEO_OUTPUT_FILE = './recording.mp4'

ffmpeg.setFfmpegPath(ffmpegPath);

var startTime, endTime;

function start() {
  startTime = new Date();
};

function end() {
  endTime = new Date();
  var timeDiff = endTime - startTime; //in ms
  // strip the ms
  timeDiff /= 1000;

  // get seconds 
  var seconds = Math.round(timeDiff);
  return seconds
}

let CalculateRMS = function (arr) { 
  
  // Map will return another array with each  
  // element corresponding to the elements of 
  // the original array mapped according to 
  // some relation 
  let Squares = arr.map((val) => (val*val)); 

  // Function reduce the array to a value 
  // Here, all the elements gets added to the first 
  // element which acted as the accumulator initially. 
  let Sum = Squares.reduce((acum, val) => (acum + val)); 
  var Mean;
  Mean = Sum/arr.length; 
  return Math.sqrt(Mean); 
} 


function beforeOffer(peerConnection) {
  const audioTransceiver = peerConnection.addTransceiver('audio');
  const videoTransceiver = peerConnection.addTransceiver('video');
  const stream = {
    recordPath: 'test'+ '.mp4',
    audio: new PassThrough()
  };

  const audioSink = new RTCAudioSink(audioTransceiver.receiver.track);
  const streams = [];


  const onAudioData = (data) => {
    if (!stream.end) {

      var rms = CalculateRMS(data.samples)
      if(rms < 10){
        if(end() > 0.3){
          // createWave(voicedFrames);
          // voicedFrames = [];
          stream.audio.push(null);
          finished(stream.audio,(err) => {
            if (err) {
              console.error('Stream failed.', err);
            } else {
              console.log('Stream is done reading.');
            }
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
        // video.end();
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
          console.log("Save File");
        }else{
          stream.audio.push(Buffer.from(data.samples.buffer));
          stream.audio.e

          console.log("Silence is smaller but time not elapsed")
        }
      }else{
        start();
        stream.audio.push(Buffer.from(data.samples.buffer));

        console.log("No Silence")
      }
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


  


  return Promise.all([
    audioTransceiver.sender.replaceTrack(audioTransceiver.receiver.track),
    videoTransceiver.sender.replaceTrack(videoTransceiver.receiver.track)
  ]);
}





module.exports = { beforeOffer };
