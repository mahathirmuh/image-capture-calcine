export type CaptureStatus = "verified" | "succeeded" | "retake";

export type CaptureRecord = {
  id: string;
  sampleId: string;
  capturedTime: string;
  session: string;
  plant: string;
  stationBin: string;
  status: CaptureStatus;
  fileName: string;
  device: string;
};

export const MOCK_CAPTURES: CaptureRecord[] = [
  {
    id: "994-xq2",
    sampleId: "994-XQ2",
    capturedTime: "14:02:45",
    session: "SESS-9942",
    plant: "Calcine-Alpha",
    stationBin: "Bin-B2",
    status: "verified",
    fileName: "CAP_9942_B2.RAW",
    device: "Rig Alpha - Sector 7G",
  },
  {
    id: "884-x",
    sampleId: "884-X",
    capturedTime: "11:18:09",
    session: "SESS-8841",
    plant: "Calcine-Alpha",
    stationBin: "Train-04",
    status: "succeeded",
    fileName: "CAP_8841_T4.RAW",
    device: "Rig Alpha - Sector 7G",
  },
  {
    id: "771-r2",
    sampleId: "771-R2",
    capturedTime: "08:42:17",
    session: "SESS-7710",
    plant: "Calcine-Alpha",
    stationBin: "Bin-A1",
    status: "retake",
    fileName: "CAP_7710_A1.RAW",
    device: "Rig Alpha - Sector 7G",
  },
];
