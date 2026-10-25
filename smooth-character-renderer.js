/* Play whole-portrait keyframes and offline-computed in-betweens.
 * No live mesh deformation, neck layer or image-opacity crossfade. */
(() => {
  'use strict';
  window.createWoolMotionRenderer = async holder => {
    const specification=document.getElementById('character-motion-data');
    if(!specification)throw new Error('Character frame data is missing');
    const data=JSON.parse(specification.textContent);
    const images=data.positions.map((_,i)=>holder.querySelector(`img[data-motion-source="${i}"]`));
    if(images.some(image=>!image))throw new Error('Character frame is missing');
    const front=images[data.frontFrame];
    await front.decode();
    function fallback(){
      images.forEach(image=>{image.hidden=image!==front;});
      holder.classList.remove('continuous-render-ready');
      return {mode:'static-fallback',render(){}};
    }
    const canvas=document.createElement('canvas');
    canvas.className='smooth-character-canvas';canvas.setAttribute('aria-hidden','true');
    const context=canvas.getContext('2d',{alpha:true});
    if(!context)return fallback();
    // Bound concurrent decodes; the sequence is ready before pointer playback.
    let decodeIndex=0;
    async function decodeWorker(){
      while(decodeIndex<images.length){
        const image=images[decodeIndex++];await image.decode();
        if(!image.naturalWidth)throw new Error('Empty character frame');
      }
    }
    await Promise.all(Array.from({length:4},decodeWorker));
    let last=0,lastFrame=-1,disposed=false;
    function render(value){
      if(disposed)return;
      last=Math.max(-1,Math.min(1,Number(value)||0));
      const positions=data.positions;
      let lower=0,upper=positions.length-1;
      while(lower+1<upper){const middle=(lower+upper)>>1;if(positions[middle]<=last)lower=middle;else upper=middle;}
      const index=Math.abs(positions[lower]-last)<=Math.abs(positions[upper]-last)?lower:upper;
      if(index===lastFrame)return;
      context.clearRect(0,0,canvas.width,canvas.height);
      context.drawImage(images[index],0,0,canvas.width,canvas.height);
      lastFrame=index;holder.dataset.currentFrame=String(index);
    }
    function resize(){
      const width=holder.getBoundingClientRect().width,requested=Number(holder.dataset.renderResolution)||0;
      const size=Math.min(data.frameSize||768,Math.max(256,requested||Math.round(width*Math.min(devicePixelRatio||1,1.5))));
      if(canvas.width!==size){canvas.width=canvas.height=size;lastFrame=-1;render(last);}
    }
    holder.append(canvas);resize();render(0);holder.classList.add('continuous-render-ready');
    images.forEach(image=>{image.hidden=true;});holder.dataset.frameCount=String(images.length);
    const observer=new ResizeObserver(resize);observer.observe(holder);
    return {mode:'interpolated-keyframes',render,dispose(){disposed=true;observer.disconnect();canvas.remove();}};
  };
})();
