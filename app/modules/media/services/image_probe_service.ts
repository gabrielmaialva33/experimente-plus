import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

import { inject } from '@adonisjs/core'
import type { MultipartFile } from '@adonisjs/core/types/bodyparser'

import BadRequestException from '#exceptions/bad_request_exception'
import {
  MEDIA_MAX_DIMENSION,
  MEDIA_MAX_FILE_SIZE_BYTES,
  MEDIA_MAX_PIXEL_AREA,
} from '#modules/media/interfaces/media_interface'
import type IMedia from '#modules/media/interfaces/media_interface'

interface DetectedImage {
  extension: IMedia.ImageExtension
  mime_type: IMedia.ImageMimeType
  width: number
  height: number
}

@inject()
export default class ImageProbeService {
  async probe(file: MultipartFile): Promise<IMedia.ImageProbeResult> {
    if (!file.tmpPath) {
      throw new BadRequestException('The uploaded image could not be inspected')
    }

    const buffer = await readFile(file.tmpPath)

    if (buffer.length === 0) {
      throw new BadRequestException('The uploaded image is empty')
    }

    if (buffer.length > MEDIA_MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('The uploaded image exceeds the 10 MiB limit')
    }

    const detected = this.detect(buffer)
    const extension = this.normalizeExtension(extname(file.clientName))
    const reportedMime = this.reportedMime(file)

    const extensionMatches =
      detected.extension === 'jpg'
        ? extension === 'jpg' || extension === 'jpeg'
        : extension === detected.extension

    if (!extensionMatches) {
      throw new BadRequestException(
        `Image extension does not match its binary content; expected ${detected.extension}`
      )
    }

    if (reportedMime !== detected.mime_type) {
      throw new BadRequestException(
        `Image MIME type does not match its binary content; expected ${detected.mime_type}`
      )
    }

    if (
      detected.width < 1 ||
      detected.height < 1 ||
      detected.width > MEDIA_MAX_DIMENSION ||
      detected.height > MEDIA_MAX_DIMENSION ||
      detected.width * detected.height > MEDIA_MAX_PIXEL_AREA
    ) {
      throw new BadRequestException('Image dimensions exceed the supported limits')
    }

    return {
      extension: detected.extension,
      mime_type: detected.mime_type,
      width: detected.width,
      height: detected.height,
      checksum_sha256: createHash('sha256').update(buffer).digest('hex'),
      size: buffer.length,
    }
  }

  private detect(buffer: Buffer): DetectedImage {
    if (this.isPng(buffer)) {
      return this.readPng(buffer)
    }

    if (this.isJpeg(buffer)) {
      return this.readJpeg(buffer)
    }

    if (this.isWebp(buffer)) {
      return this.readWebp(buffer)
    }

    throw new BadRequestException('Only valid JPEG, PNG and WebP images are supported')
  }

  private isPng(buffer: Buffer): boolean {
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    return buffer.length >= 24 && buffer.subarray(0, 8).equals(signature)
  }

  private readPng(buffer: Buffer): DetectedImage {
    if (buffer.subarray(12, 16).toString('ascii') !== 'IHDR') {
      throw new BadRequestException('PNG image is missing its IHDR header')
    }

    return {
      extension: 'png',
      mime_type: 'image/png',
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    }
  }

  private isJpeg(buffer: Buffer): boolean {
    return buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  }

  private readJpeg(buffer: Buffer): DetectedImage {
    const startOfFrameMarkers = new Set([
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
    ])

    let offset = 2

    while (offset + 4 <= buffer.length) {
      while (offset < buffer.length && buffer[offset] !== 0xff) {
        offset += 1
      }

      while (offset < buffer.length && buffer[offset] === 0xff) {
        offset += 1
      }

      if (offset >= buffer.length) {
        break
      }

      const marker = buffer[offset]
      offset += 1

      if (marker === 0xd8 || marker === 0xd9 || marker === 0x01) {
        continue
      }

      if (offset + 2 > buffer.length) {
        break
      }

      const segmentLength = buffer.readUInt16BE(offset)
      if (segmentLength < 2 || offset + segmentLength > buffer.length) {
        throw new BadRequestException('JPEG image contains an invalid segment')
      }

      if (startOfFrameMarkers.has(marker)) {
        if (segmentLength < 7) {
          throw new BadRequestException('JPEG image contains an invalid frame header')
        }

        return {
          extension: 'jpg',
          mime_type: 'image/jpeg',
          height: buffer.readUInt16BE(offset + 3),
          width: buffer.readUInt16BE(offset + 5),
        }
      }

      offset += segmentLength
    }

    throw new BadRequestException('JPEG image dimensions could not be determined')
  }

  private isWebp(buffer: Buffer): boolean {
    return (
      buffer.length >= 30 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    )
  }

  private readWebp(buffer: Buffer): DetectedImage {
    let offset = 12

    while (offset + 8 <= buffer.length) {
      const chunkType = buffer.subarray(offset, offset + 4).toString('ascii')
      const chunkSize = buffer.readUInt32LE(offset + 4)
      const dataOffset = offset + 8
      const chunkEnd = dataOffset + chunkSize

      if (chunkEnd > buffer.length) {
        throw new BadRequestException('WebP image contains an invalid chunk')
      }

      if (chunkType === 'VP8X' && chunkSize >= 10) {
        return {
          extension: 'webp',
          mime_type: 'image/webp',
          width: 1 + this.readUInt24LE(buffer, dataOffset + 4),
          height: 1 + this.readUInt24LE(buffer, dataOffset + 7),
        }
      }

      if (chunkType === 'VP8L' && chunkSize >= 5) {
        if (buffer[dataOffset] !== 0x2f) {
          throw new BadRequestException('WebP lossless image has an invalid signature')
        }

        const byte1 = buffer[dataOffset + 1]
        const byte2 = buffer[dataOffset + 2]
        const byte3 = buffer[dataOffset + 3]
        const byte4 = buffer[dataOffset + 4]

        return {
          extension: 'webp',
          mime_type: 'image/webp',
          width: 1 + (((byte2 & 0x3f) << 8) | byte1),
          height: 1 + (((byte4 & 0x0f) << 10) | (byte3 << 2) | ((byte2 & 0xc0) >> 6)),
        }
      }

      if (chunkType === 'VP8 ' && chunkSize >= 10) {
        if (
          buffer[dataOffset + 3] !== 0x9d ||
          buffer[dataOffset + 4] !== 0x01 ||
          buffer[dataOffset + 5] !== 0x2a
        ) {
          throw new BadRequestException('WebP lossy image has an invalid frame signature')
        }

        return {
          extension: 'webp',
          mime_type: 'image/webp',
          width: buffer.readUInt16LE(dataOffset + 6) & 0x3fff,
          height: buffer.readUInt16LE(dataOffset + 8) & 0x3fff,
        }
      }

      offset = chunkEnd + (chunkSize % 2)
    }

    throw new BadRequestException('WebP image dimensions could not be determined')
  }

  private readUInt24LE(buffer: Buffer, offset: number): number {
    return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16)
  }

  private normalizeExtension(extension: string | undefined): string {
    return (extension ?? '').trim().toLowerCase().replace(/^\./, '')
  }

  private reportedMime(file: MultipartFile): string {
    const type = file.type?.trim().toLowerCase() ?? ''
    const subtype = file.subtype?.trim().toLowerCase() ?? ''

    if (!type || (!type.includes('/') && !subtype)) {
      throw new BadRequestException('The uploaded image must include a valid MIME type')
    }

    return type.includes('/') ? type : `${type}/${subtype}`
  }
}
