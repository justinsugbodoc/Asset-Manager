import { doctors, labResults, soapNotes } from '@/data/mock';

export type SoapNote = {
  id: string;
  date: string;
  doctor: string;
  consultationReference: string;
  status: 'Signed' | 'Draft' | 'Amended';
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

export type ImagingRecord = {
  id: string;
  patientId: string;
  patientName: string;
  type: 'X-ray' | 'Ultrasound' | 'CT scan' | 'MRI';
  bodyArea: string;
  date: string;
  doctor: string;
  findings: string;
  impression: string;
  status: 'Final' | 'Preliminary' | 'Reviewed';
  imageUrl?: string;
  reportText: string;
};

export const SAMPLE_IMAGING_IMAGE =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="620" viewBox="0 0 900 620">
    <defs><radialGradient id="bg"><stop offset="0" stop-color="#d9e4ef"/><stop offset="1" stop-color="#1e293b"/></radialGradient></defs>
    <rect width="900" height="620" fill="#0f172a"/><rect x="70" y="45" width="760" height="530" rx="18" fill="url(#bg)"/>
    <ellipse cx="330" cy="300" rx="108" ry="185" fill="#b8c7d6" opacity=".8"/><ellipse cx="570" cy="300" rx="108" ry="185" fill="#b8c7d6" opacity=".8"/>
    <path d="M450 125v350M345 155c38 35 72 40 105 15M555 155c-38 35-72 40-105 15" stroke="#f8fafc" stroke-width="15" opacity=".75" fill="none"/>
    <path d="M250 190h400M230 250h440M225 315h450M245 380h410M275 445h350" stroke="#64748b" stroke-width="5" opacity=".55"/>
    <text x="95" y="90" fill="#0f172a" font-family="sans-serif" font-size="22" font-weight="700">SUGBODOC • SAMPLE CHEST X-RAY</text>
    <text x="95" y="550" fill="#f8fafc" font-family="sans-serif" font-size="18">Prototype image — not for clinical diagnosis</text>
  </svg>`);

export const imagingRecords: ImagingRecord[] = [
  {
    id: 'img_1',
    patientId: 'pt_123',
    patientName: 'Juan dela Cruz',
    type: 'X-ray',
    bodyArea: 'Chest, PA view',
    date: 'Jun 12, 2024',
    doctor: doctors[0].name,
    findings: 'Cardiomediastinal silhouette is within normal limits. Lungs are clear without focal air-space opacity. No pleural effusion or pneumothorax.',
    impression: 'No acute cardiopulmonary abnormality.',
    status: 'Final',
    imageUrl: SAMPLE_IMAGING_IMAGE,
    reportText: 'CHEST X-RAY REPORT\n\nPatient: Juan dela Cruz\nStudy: Chest X-ray, PA view\nDate: Jun 12, 2024\nOrdering physician: Dr. Maria Santos\n\nFindings:\nCardiomediastinal silhouette is within normal limits. Lungs are clear without focal air-space opacity. No pleural effusion or pneumothorax.\n\nImpression:\nNo acute cardiopulmonary abnormality.\n\nPrototype report for testing only.',
  },
  {
    id: 'img_2',
    patientId: 'pt_123',
    patientName: 'Juan dela Cruz',
    type: 'Ultrasound',
    bodyArea: 'Upper abdomen',
    date: 'Apr 18, 2024',
    doctor: doctors[1].name,
    findings: 'Liver is normal in size with mildly increased echogenicity. Gallbladder is unremarkable without stones. Kidneys are normal in size.',
    impression: 'Mild hepatic steatosis. No acute upper abdominal sonographic abnormality.',
    status: 'Reviewed',
    reportText: 'UPPER ABDOMINAL ULTRASOUND REPORT\n\nPatient: Juan dela Cruz\nStudy: Upper abdomen ultrasound\nDate: Apr 18, 2024\nOrdering physician: Dr. Jose Reyes\n\nFindings:\nLiver is normal in size with mildly increased echogenicity. Gallbladder is unremarkable without stones. Kidneys are normal in size.\n\nImpression:\nMild hepatic steatosis. No acute upper abdominal sonographic abnormality.\n\nPrototype report for testing only.',
  },
];

export function getSoapNotes(): SoapNote[] {
  return soapNotes.map((note, index) => ({
    ...note,
    consultationReference: index === 0 ? 'CONS-2024-0610-001' : `CONS-2024-${index + 1}`,
    status: 'Signed',
  }));
}

export function getImagingRecords(): ImagingRecord[] {
  return imagingRecords;
}

export function downloadImagingReport(record: ImagingRecord) {
  const blob = new Blob([record.reportText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${record.id}-${record.type.toLowerCase().replace(/\s+/g, '-')}-report.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function getLabResultsWithImaging() {
  return labResults;
}