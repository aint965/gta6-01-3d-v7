export const mat4 = () => new Float32Array(16);

export function identity(output) {
  output.fill(0);
  output[0] = output[5] = output[10] = output[15] = 1;
  return output;
}

// Matrices are column-major; the temporary lets output safely alias either input.
export function multiply(output, left, right) {
  const result = new Float32Array(16);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      result[column * 4 + row] = left[row] * right[column * 4]
        + left[4 + row] * right[column * 4 + 1]
        + left[8 + row] * right[column * 4 + 2]
        + left[12 + row] * right[column * 4 + 3];
    }
  }
  output.set(result);
  return output;
}

export function perspective(output, fieldOfView, aspect, near, far) {
  const focalLength = 1 / Math.tan(fieldOfView / 2);
  output.fill(0);
  output[0] = focalLength / aspect;
  output[5] = focalLength;
  output[10] = (far + near) / (near - far);
  output[11] = -1;
  output[14] = (2 * far * near) / (near - far);
  return output;
}

export function lookAt(output, eye, center, up) {
  let zx = eye[0] - center[0];
  let zy = eye[1] - center[1];
  let zz = eye[2] - center[2];
  let length = Math.hypot(zx, zy, zz);
  zx /= length;
  zy /= length;
  zz /= length;

  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  length = Math.hypot(xx, xy, xz);
  xx /= length;
  xy /= length;
  xz /= length;

  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  output[0] = xx; output[1] = yx; output[2] = zx; output[3] = 0;
  output[4] = xy; output[5] = yy; output[6] = zy; output[7] = 0;
  output[8] = xz; output[9] = yz; output[10] = zz; output[11] = 0;
  output[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  output[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  output[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  output[15] = 1;
  return output;
}
