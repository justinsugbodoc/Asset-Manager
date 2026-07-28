export type Patient = {
  id: string;
  name: string;
  initials: string;
  age: number;
  gender: string;
  dob: string;
  bloodType: string;
  allergies: string[];
  emergencyContact: {
    name: string;
    number: string;
  };
};

export const currentPatient: Patient = {
  id: 'pt_123',
  name: 'Juan dela Cruz',
  initials: 'JD',
  age: 34,
  gender: 'M',
  dob: 'March 15, 1991',
  bloodType: 'O+',
  allergies: ['Penicillin', 'Dust Mites'],
  emergencyContact: {
    name: 'Maria dela Cruz',
    number: '+63 912 345 6789'
  }
};

export const specialties = [
  'Internal Medicine',
  'Cardiology',
  'OB-GYN',
  'Dermatology',
  'Pediatrics',
  'Orthopedics',
  'Ophthalmology',
  'ENT',
  'Neurology'
];

export const doctors = [
  { id: 'dr_1', name: 'Dr. Maria Santos', initials: 'MS', specialty: 'Internal Medicine', clinic: 'Cebu Doctors\' University Hospital' },
  { id: 'dr_2', name: 'Dr. Jose Reyes', initials: 'JR', specialty: 'Cardiology', clinic: 'Chong Hua Hospital' },
  { id: 'dr_3', name: 'Dr. Ana Villanueva', initials: 'AV', specialty: 'OB-GYN', clinic: 'Perpetual Succour Hospital' },
  { id: 'dr_4', name: 'Dr. Carlo Mendoza', initials: 'CM', specialty: 'Dermatology', clinic: 'Vicente Sotto Memorial Medical Center' },
  { id: 'dr_5', name: 'Dr. Lea Fernandez', initials: 'LF', specialty: 'Pediatrics', clinic: 'Cebu Doctors\' University Hospital' }
];

export const clinics = [
  'Cebu Doctors\' University Hospital',
  'Perpetual Succour Hospital',
  'Chong Hua Hospital',
  'Vicente Sotto Memorial Medical Center'
];

export const upcomingAppointments = [
  {
    id: 'apt_1',
    date: 'Jul 30, 2024',
    time: '10:00 AM',
    doctor: doctors[0],
    status: 'Confirmed'
  },
  {
    id: 'apt_2',
    date: 'Aug 15, 2024',
    time: '2:30 PM',
    doctor: doctors[1],
    status: 'Pending'
  },
  {
    id: 'apt_3',
    date: 'Aug 22, 2024',
    time: '9:00 AM',
    doctor: doctors[3],
    status: 'Confirmed'
  }
];

export const pastAppointments = [
  {
    id: 'apt_10',
    date: 'Jun 10, 2024',
    time: '11:00 AM',
    doctor: doctors[0],
    status: 'Completed'
  },
  {
    id: 'apt_11',
    date: 'May 05, 2024',
    time: '3:00 PM',
    doctor: doctors[2],
    status: 'Completed'
  }
];

export const activities = [
  { id: 'act_1', text: 'Lab results for Lipid Panel uploaded', time: '2 hours ago', type: 'record' },
  { id: 'act_2', text: 'Appointment confirmed with Dr. Maria Santos', time: 'Yesterday', type: 'appointment' },
  { id: 'act_3', text: 'New message from Dr. Maria Santos', time: '2 days ago', type: 'message' },
  { id: 'act_4', text: 'Prescription for Losartan renewed', time: 'Last week', type: 'prescription' },
  { id: 'act_5', text: 'Payment successful for previous visit', time: 'Last week', type: 'billing' }
];

export const vitalsData = [
  { date: 'Jan 10', systolic: 120, diastolic: 80, heartRate: 72, temp: 36.5, weight: 75.5 },
  { date: 'Feb 15', systolic: 125, diastolic: 82, heartRate: 75, temp: 36.6, weight: 76.0 },
  { date: 'Mar 20', systolic: 130, diastolic: 85, heartRate: 78, temp: 36.7, weight: 76.2 },
  { date: 'Apr 25', systolic: 128, diastolic: 84, heartRate: 74, temp: 36.5, weight: 75.8 },
  { date: 'May 30', systolic: 135, diastolic: 88, heartRate: 80, temp: 36.8, weight: 77.1 },
  { date: 'Jun 15', systolic: 122, diastolic: 81, heartRate: 70, temp: 36.6, weight: 75.0 }
];

export const recordsTabs = ['Encounters', 'Vitals', 'Prescriptions', 'Lab Results', 'SOAP Notes', 'Diagnoses'];

export const encounters = [
  { id: 'enc_1', date: 'Jun 10, 2024', doctor: doctors[0].name, complaint: 'Routine Follow-up', summary: 'Patient reported feeling well. BP is stable with current medication.' },
  { id: 'enc_2', date: 'Feb 15, 2024', doctor: doctors[1].name, complaint: 'Occasional chest palpitations', summary: 'ECG normal. Advised to reduce caffeine intake.' },
  { id: 'enc_3', date: 'Oct 05, 2023', doctor: doctors[0].name, complaint: 'Annual Physical Exam', summary: 'Overall healthy. Minor elevation in LDL cholesterol.' }
];

export const prescriptions = [
  { id: 'rx_1', name: 'Losartan', dosage: '50mg', instructions: 'Take 1 tablet daily in the morning', status: 'Active' },
  { id: 'rx_2', name: 'Atorvastatin', dosage: '20mg', instructions: 'Take 1 tablet daily at bedtime', status: 'Refill Needed' },
  { id: 'rx_3', name: 'Amoxicillin', dosage: '500mg', instructions: 'Take 1 capsule every 8 hours for 7 days', status: 'Completed' }
];

export const labResults = [
  { id: 'lab_1', test: 'Total Cholesterol', result: '220 mg/dL', range: '< 200 mg/dL', date: 'Jun 05, 2024', status: 'Abnormal' },
  { id: 'lab_2', test: 'LDL Cholesterol', result: '145 mg/dL', range: '< 130 mg/dL', date: 'Jun 05, 2024', status: 'Abnormal' },
  { id: 'lab_3', test: 'HDL Cholesterol', result: '45 mg/dL', range: '> 40 mg/dL', date: 'Jun 05, 2024', status: 'Normal' },
  { id: 'lab_4', test: 'Fasting Blood Sugar', result: '92 mg/dL', range: '70 - 99 mg/dL', date: 'Jun 05, 2024', status: 'Normal' }
];

export const soapNotes = [
  { 
    id: 'soap_1', 
    date: 'Jun 10, 2024', 
    doctor: doctors[0].name,
    subjective: 'Patient returns for follow-up of hypertension and mild hyperlipidemia. Reports adherence to Losartan. No chest pain, shortness of breath, or headaches.',
    objective: 'BP 122/81, HR 70, Wt 75kg. Heart: regular rate and rhythm. Lungs: clear to auscultation.',
    assessment: '1. Hypertension, well-controlled.\n2. Hyperlipidemia, slightly elevated LDL despite diet.',
    plan: '1. Continue Losartan 50mg daily.\n2. Start Atorvastatin 20mg daily.\n3. Recheck lipid panel in 3 months.'
  }
];

export const diagnoses = [
  { id: 'dx_1', code: 'I10', description: 'Essential (primary) hypertension', date: 'Jan 2022', status: 'Active' },
  { id: 'dx_2', code: 'E78.5', description: 'Hyperlipidemia, unspecified', date: 'Oct 2023', status: 'Active' },
  { id: 'dx_3', code: 'J02.9', description: 'Acute pharyngitis, unspecified', date: 'Mar 2023', status: 'Resolved' }
];

export const inbox = [
  {
    id: 'msg_thread_1',
    doctor: doctors[0],
    lastMessage: 'Your recent lab results look much better. Keep it up!',
    timestamp: '10:30 AM',
    unread: true,
    messages: [
      { id: 'm1', sender: 'doctor', text: 'Hi Juan, I reviewed your recent lipid panel.', time: '10:20 AM' },
      { id: 'm2', sender: 'doctor', text: 'Your LDL has gone down to 110 mg/dL.', time: '10:21 AM' },
      { id: 'm3', sender: 'patient', text: 'That\'s great news, Doc! The new diet is really helping.', time: '10:25 AM' },
      { id: 'm4', sender: 'patient', text: 'Should I keep the same dosage for Atorvastatin?', time: '10:26 AM' },
      { id: 'm5', sender: 'doctor', text: 'Yes, let\'s stick to 20mg daily for now.', time: '10:29 AM' },
      { id: 'm6', sender: 'doctor', text: 'Your recent lab results look much better. Keep it up!', time: '10:30 AM' }
    ]
  },
  {
    id: 'msg_thread_2',
    doctor: doctors[4],
    lastMessage: 'Please don\'t forget to upload the vaccination record.',
    timestamp: 'Yesterday',
    unread: false,
    messages: []
  },
  {
    id: 'msg_thread_3',
    doctor: doctors[2],
    lastMessage: 'The referral letter is ready for pickup.',
    timestamp: 'Mon',
    unread: false,
    messages: []
  }
];

export const bills = [
  { id: 'bill_1', description: 'Consultation - Dr. Maria Santos', date: 'Jul 30, 2024', amount: 800, status: 'Pending' },
  { id: 'bill_2', description: 'Comprehensive Lipid Panel', date: 'Jun 05, 2024', amount: 3700, status: 'Pending' }
];

export const pastBills = [
  { id: 'bill_3', description: 'Consultation - Dr. Jose Reyes', date: 'Feb 15, 2024', amount: 1200, status: 'Paid', receiptId: 'RCP-8891' },
  { id: 'bill_4', description: 'Annual Physical Exam Package', date: 'Oct 05, 2023', amount: 4500, status: 'Paid', receiptId: 'RCP-7742' }
];
