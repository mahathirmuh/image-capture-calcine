import { describe, expect, it } from "vitest";

import {
  buildDeviceProfileFromRegisteredDevice,
  toUpsertRegisteredDeviceInput,
  type RegisteredDevice,
} from "./device-registry";

const registeredDevice: RegisteredDevice = {
  id: 1,
  deviceCode: "A72F-8812",
  deviceName: "MINIPC-004",
  plant: "Kaltim 1",
  area: null,
  bin: "Bin 1",
  station: "Main Area",
  description: "Calcine station",
  templateId: "default-calcine-r50",
  schedule: "Every 3 Hours",
  timezone: "Asia/Makassar (WITA)",
  cameraSettings: {
    iso: "200",
    shutter: "1/125",
    aperture: "f/8",
    whiteBalance: "Daylight",
    pictureStyle: "Standard",
    focusMode: "Autofocus",
  },
  serialNumber: "SER-001",
  ipAddress: "10.60.20.196",
  connectionType: "usb",
  cameraModel: "Canon R50",
  edgeApiUrl: "http://10.60.20.196:3000",
  isActive: true,
  createdAt: "2026-07-22T10:00:00.000Z",
  updatedAt: "2026-07-22T10:05:00.000Z",
};

describe("device-registry helpers", () => {
  it("builds a local device profile from a registered device", () => {
    const profile = buildDeviceProfileFromRegisteredDevice(registeredDevice);

    expect(profile).toMatchObject({
      deviceCode: "A72F-8812",
      deviceName: "MINIPC-004",
      plant: "Kaltim 1",
      bin: "Bin 1",
      station: "Main Area",
      description: "Calcine station",
      templateId: "default-calcine-r50",
      schedule: "Every 3 Hours",
      timezone: "Asia/Makassar (WITA)",
      edgeProfileId: null,
      edgeLastAppliedAt: null,
    });
  });

  it("maps a saved device profile back to upsert input", () => {
    const profile = buildDeviceProfileFromRegisteredDevice(registeredDevice);
    expect(toUpsertRegisteredDeviceInput(profile)).toEqual({
      deviceCode: "A72F-8812",
      deviceName: "MINIPC-004",
      plant: "Kaltim 1",
      bin: "Bin 1",
      station: "Main Area",
      description: "Calcine station",
      templateId: "default-calcine-r50",
      schedule: "Every 3 Hours",
      timezone: "Asia/Makassar (WITA)",
      cameraSettings: registeredDevice.cameraSettings,
    });
  });
});

describe("toUpsertRegisteredDeviceInput and edgeApiUrl", () => {
  it("never mentions edgeApiUrl at all", () => {
    // Halaman Devices menyimpan profil lewat konverter ini tanpa tahu-menahu
    // soal alamat Edge API. Begitu konverternya menyebut edgeApiUrl -- entah
    // sebagai "" atau null -- setiap penyimpanan profil akan menghapus alamat
    // yang sudah diisi benar, tanpa ada yang meminta. Ketidakhadirannya di sini
    // yang menjaga alamat itu tetap utuh.
    const profile = buildDeviceProfileFromRegisteredDevice(registeredDevice);
    expect("edgeApiUrl" in toUpsertRegisteredDeviceInput(profile)).toBe(false);
  });
});
