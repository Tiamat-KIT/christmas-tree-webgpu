import './style.css'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <canvas width="2500" height="2500" />
`

async function init() {
  if (!navigator.gpu) {
      document.body.textContent = 'WebGPU not supported';
      return;
  }

  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter!.requestDevice();
  const canvas = document.querySelector('canvas') as HTMLCanvasElement;
  
  const devicePixelRatio = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;

  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  
  context!.configure({
      device,
      format,
      alphaMode: 'premultiplied',
  });

  const vertices = new Float32Array([
      // 葉
      0.0, 0.2, 0.0,     0.0, 0.8, 0.0,
      0.5, -0.6, 0.0,    0.0, 0.6, 0.0,
      -0.5, -0.6, 0.0,   0.0, 0.6, 0.0,

      0.0, 0.5, 0.0,     0.0, 0.8, 0.0,
      0.4, -0.2, 0.0,     0.0, 0.6, 0.0,
      -0.4, -0.2, 0.0,    0.0, 0.6, 0.0,

      0.0, 0.7, 0.0,     0.0, 0.8, 0.0,
      0.3, 0.2, 0.0,     0.0, 0.6, 0.0,
      -0.3, 0.2, 0.0,    0.0, 0.6, 0.0,

      // トランク（幅を3倍に）
      0.0, -0.4, 0.1,    0.6, 0.3, 0.0,
      0.3, -1.0, 0.1,    0.6, 0.3, 0.0,
      -0.3, -1.0, 0.1,   0.6, 0.3, 0.0,

      // 星
      0.0, 0.8, 0.2,     1.0, 1.0, 0.0,
      0.1, 0.7, 0.2,     1.0, 1.0, 0.0,
      -0.1, 0.7, 0.2,    1.0, 1.0, 0.0,
  ]);

  const vertexBuffer = device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertices);

  const shader = device.createShaderModule({
      code: `
          struct VertexOutput {
              @builtin(position) position: vec4f,
              @location(0) color: vec3f,
          }

          @vertex
          fn vertexMain(@location(0) position: vec3f,
                      @location(1) color: vec3f) -> VertexOutput {
              var output: VertexOutput;
              output.position = vec4f(position, 1.0);
              output.color = color;
              return output;
          }

          @fragment
          fn fragmentMain(@location(0) color: vec3f) -> @location(0) vec4f {
              return vec4f(color, 1.0);
          }
      `
  });

  const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
          module: shader,
          entryPoint: 'vertexMain',
          buffers: [{
              arrayStride: 24,
              attributes: [
                  {
                      format: 'float32x3',
                      offset: 0,
                      shaderLocation: 0
                  },
                  {
                      format: 'float32x3',
                      offset: 12,
                      shaderLocation: 1
                  }
              ]
          }]
      },
      fragment: {
          module: shader,
          entryPoint: 'fragmentMain',
          targets: [{
              format
          }]
      },
      primitive: {
          cullMode: 'none'
      },
      depthStencil: {
          format: 'depth24plus',
          depthWriteEnabled: true,
          depthCompare: 'less'
      }
  });

  function frame() {
      const depthTexture = device.createTexture({
          size: [canvas.width, canvas.height],
          format: 'depth24plus',
          usage: GPUTextureUsage.RENDER_ATTACHMENT
      });

      const commandEncoder = device.createCommandEncoder();
      const textureView = context!.getCurrentTexture().createView();

      const renderPass = commandEncoder.beginRenderPass({
          colorAttachments: [{
              view: textureView,
              clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.2 },
              loadOp: 'clear',
              storeOp: 'store'
          }],
          depthStencilAttachment: {
              view: depthTexture.createView(),
              depthClearValue: 1.0,
              depthLoadOp: 'clear',
              depthStoreOp: 'store'
          }
      });

      renderPass.setPipeline(pipeline);
      renderPass.setVertexBuffer(0, vertexBuffer);
      renderPass.draw(15);
      renderPass.end();

      device.queue.submit([commandEncoder.finish()]);
      requestAnimationFrame(frame);
  }

  window.addEventListener('resize', () => {
      canvas.width = canvas.clientWidth * devicePixelRatio;
      canvas.height = canvas.clientHeight * devicePixelRatio;
  });

  requestAnimationFrame(frame);
}

init();