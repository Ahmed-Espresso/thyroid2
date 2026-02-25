if (localStorage.getItem('doctorLoggedIn') !== 'true') {
  window.location.href = 'login.html';
}
document.getElementById('doctorName').innerText = localStorage.getItem('doctorName') || 'Doctor';

// Elements
const patientsGrid = document.getElementById('patientsGrid');
const noPatientsMessage = document.getElementById('noPatientsMessage');
const modal = document.getElementById('decisionModal');
const closeModal = document.querySelector('.close');
const updateForm = document.getElementById('updateForm');
const sendWhatsAppBtn = document.getElementById('sendWhatsAppBtn');
const logoutBtn = document.getElementById('logoutBtn');
const exportDataBtn = document.getElementById('exportDataBtn');
const refreshBtn = document.getElementById('refreshDataBtn');
const loadingOverlay = document.getElementById('dashboard-loading');

// Filters
const searchInput = document.getElementById('searchInput');
const resultFilter = document.getElementById('resultFilter');
const tiradsFilter = document.getElementById('tiradsFilter');
const timeFilter = document.getElementById('timeFilter');
const customDateRange = document.getElementById('customDateRange');
const dateFrom = document.getElementById('dateFrom');
const dateTo = document.getElementById('dateTo');

let currentPatientId = null;
let currentDecisionId = null;
let currentPhone = '';

// Data stores
let allPatients = [];
let allDecisions = [];
let allImages = [];
let allRecords = [];

// Load data with retry mechanism
async function loadData(showLoading = true) {
  if (showLoading) {
    loadingOverlay.style.display = 'block';
    patientsGrid.style.opacity = '0.5';
  }

  try {
    const [patientsSnap, decisionsSnap, imagesSnap, recordsSnap] = await Promise.all([
      db.ref('patients').once('value'),
      db.ref('final_decisions').once('value'),
      db.ref('ultrasound_images').once('value'),
      db.ref('clinical_records').once('value')
    ]);

    // تحويل البيانات مع التأكد من وجود قيم
    allPatients = patientsSnap.val() ? Object.entries(patientsSnap.val()).map(([id, data]) => ({ id, ...data })) : [];
    allDecisions = decisionsSnap.val() ? Object.entries(decisionsSnap.val()).map(([id, data]) => ({ id, ...data })) : [];
    allImages = imagesSnap.val() ? Object.entries(imagesSnap.val()).map(([id, data]) => ({ id, ...data })) : [];
    allRecords = recordsSnap.val() ? Object.entries(recordsSnap.val()).map(([id, data]) => ({ id, ...data })) : [];

    renderPatients();
  } catch (error) {
    console.error('Error loading data:', error);
    Swal.fire({
      icon: 'error',
      title: 'Failed to load data',
      text: 'Please check your internet connection and try again.',
      confirmButtonText: 'Retry'
    }).then((result) => {
      if (result.isConfirmed) {
        loadData();
      }
    });
  } finally {
    if (showLoading) {
      loadingOverlay.style.display = 'none';
      patientsGrid.style.opacity = '1';
    }
  }
}

// Filter patients
function filterPatients() {
  const searchTerm = searchInput.value.toLowerCase();
  const resultValue = resultFilter.value;
  const tiradsValue = tiradsFilter.value;
  const timeValue = timeFilter.value;
  const from = dateFrom.value ? new Date(dateFrom.value) : null;
  const to = dateTo.value ? new Date(dateTo.value) : null;

  return allPatients.filter(patient => {
    if (searchTerm && !(patient.full_name && patient.full_name.toLowerCase().includes(searchTerm))) return false;

    const patientDecisions = allDecisions.filter(d => d.patient_id === patient.id);
    const latestDecision = patientDecisions.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
    if (resultValue !== 'all' && (!latestDecision || latestDecision.final_result !== resultValue)) return false;

    const patientRecords = allRecords.filter(r => r.patient_id === patient.id);
    const latestRecord = patientRecords.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
    if (tiradsValue !== 'all' && (!latestRecord || latestRecord.tirads_score != tiradsValue)) return false;

    if (timeValue !== 'all' && latestDecision && latestDecision.created_at) {
      const decisionDate = new Date(latestDecision.created_at);
      const now = new Date();
      if (timeValue === 'day' && (now - decisionDate) > 24*60*60*1000) return false;
      if (timeValue === 'week' && (now - decisionDate) > 7*24*60*60*1000) return false;
      if (timeValue === 'month' && (now - decisionDate) > 30*24*60*60*1000) return false;
      if (timeValue === 'custom' && from && to) {
        if (decisionDate < from || decisionDate > to) return false;
      }
    }
    return true;
  });
}

// Render patients
function renderPatients() {
  const filtered = filterPatients();

  if (filtered.length === 0) {
    patientsGrid.innerHTML = '';
    noPatientsMessage.style.display = 'block';
    return;
  }
  noPatientsMessage.style.display = 'none';

  // Latest image per patient
  const patientImageMap = {};
  allImages.forEach(img => {
    const pid = img.patient_id;
    if (!patientImageMap[pid] || new Date(img.uploaded_at || 0) > new Date(patientImageMap[pid].uploaded_at || 0)) {
      patientImageMap[pid] = img;
    }
  });

  // Latest record per patient
  const latestRecordMap = {};
  allRecords.forEach(rec => {
    const pid = rec.patient_id;
    if (!latestRecordMap[pid] || new Date(rec.created_at || 0) > new Date(latestRecordMap[pid].created_at || 0)) {
      latestRecordMap[pid] = rec;
    }
  });

  // Latest decision per patient
  const latestDecisionMap = {};
  allDecisions.forEach(dec => {
    const pid = dec.patient_id;
    if (!latestDecisionMap[pid] || new Date(dec.created_at || 0) > new Date(latestDecisionMap[pid].created_at || 0)) {
      latestDecisionMap[pid] = dec;
    }
  });

  let html = '';
  filtered.forEach(patient => {
    const pid = patient.id;
    const img = patientImageMap[pid];
    const record = latestRecordMap[pid];
    const decision = latestDecisionMap[pid];
    const imageUrl = img ? img.image_path : null;
    const tiradsScore = record ? record.tirads_score : null;
    const tiradsClass = tiradsScore ? `tirads-${tiradsScore}` : '';

    html += `
      <div class="patient-card" data-patient-id="${pid}" data-aos="fade-up">
        <div class="card-image">
          ${imageUrl ? `<img src="${imageUrl}" alt="Ultrasound" loading="lazy">` : 
            `<div class="no-image"><i class="fas fa-image"></i> No Image</div>`}
        </div>
        <div class="card-content">
          <div class="patient-header">
            <span class="patient-name">${patient.full_name || 'Unknown'}</span>
            <div class="actions">
              <i class="fas fa-download action-icon" onclick="downloadPatientCard('${pid}')" title="Download details"></i>
            </div>
          </div>
          <div class="patient-details">
            <div class="detail-item"><i class="fas fa-calendar-alt"></i> Age: ${patient.age || ''}</div>
            <div class="detail-item"><i class="fas fa-venus-mars"></i> ${patient.gender || ''}</div>
            <div class="detail-item"><i class="fas fa-phone"></i> ${patient.phone || 'N/A'}</div>
            <div class="detail-item"><i class="fas fa-calendar-check"></i> ${decision ? new Date(decision.created_at).toLocaleDateString() : '-'}</div>
          </div>
          <div class="diagnosis-badge">
            ${decision ? 
              `<span class="badge ${decision.final_result === 'Malignant' ? 'malignant' : decision.final_result === 'Benign' ? 'benign' : 'pending'}">${decision.final_result}</span>` 
              : '<span class="badge pending">Pending</span>'}
            ${tiradsScore ? `<span class="tirads-badge ${tiradsClass}">TIRADS ${tiradsScore}</span>` : ''}
          </div>
          <div class="card-actions">
            <button class="btn-edit" data-patient-id="${pid}" data-decision-id="${decision ? decision.id : ''}"><i class="fas fa-edit"></i> Edit</button>
            <button class="btn-delete" data-patient-id="${pid}"><i class="fas fa-trash"></i> Delete</button>
          </div>
        </div>
      </div>
    `;
  });

  patientsGrid.innerHTML = html;
  attachEvents();
  if (typeof AOS !== 'undefined') AOS.refresh();
}

// Attach events
function attachEvents() {
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const patientId = btn.dataset.patientId;
      const decisionId = btn.dataset.decisionId;
      openModal(patientId, decisionId);
    });
  });

  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const patientId = btn.dataset.patientId;
      const result = await Swal.fire({
        title: 'Delete patient?',
        text: 'Are you sure you want to delete this patient and all associated data? This action cannot be undone.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, delete'
      });
      if (result.isConfirmed) {
        await deletePatient(patientId);
        loadData(false);
      }
    });
  });
}

// Delete patient
async function deletePatient(patientId) {
  try {
    const decisionsToDelete = allDecisions.filter(d => d.patient_id === patientId).map(d => d.id);
    await Promise.all(decisionsToDelete.map(id => db.ref('final_decisions/' + id).remove()));

    const recordsToDelete = allRecords.filter(r => r.patient_id === patientId).map(r => r.id);
    for (const rid of recordsToDelete) {
      const preds = allDecisions.filter(d => d.record_id === rid);
      await Promise.all(preds.map(p => db.ref('clinical_predictions/' + p.id).remove()));
      await db.ref('clinical_records/' + rid).remove();
    }

    const imagesToDelete = allImages.filter(i => i.patient_id === patientId).map(i => i.id);
    for (const iid of imagesToDelete) {
      const preds = allDecisions.filter(d => d.image_id === iid);
      await Promise.all(preds.map(p => db.ref('image_predictions/' + p.id).remove()));
      await db.ref('ultrasound_images/' + iid).remove();
    }

    await db.ref('patients/' + patientId).remove();
    Swal.fire('Deleted!', 'Patient deleted successfully.', 'success');
  } catch (error) {
    console.error('Delete error:', error);
    Swal.fire('Error', 'Error deleting patient: ' + error.message, 'error');
  }
}

// Open modal
async function openModal(patientId, decisionId) {
  currentPatientId = patientId;
  currentDecisionId = decisionId;

  const patient = allPatients.find(p => p.id === patientId);
  const record = allRecords.filter(r => r.patient_id === patientId).sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
  const decision = allDecisions.find(d => d.id === decisionId);

  document.getElementById('modalPatientName').innerText = patient.full_name || 'Unknown';
  document.getElementById('modalPhone').innerText = patient.phone || 'Not provided';
  currentPhone = patient.phone || '';

  if (decision) {
    document.getElementById('modalCurrentResult').innerText = decision.final_result;
    document.getElementById('modalCurrentTirads').innerText = record ? record.tirads_score : 'N/A';
    document.getElementById('modalCurrentConfidence').innerText = (decision.confidence_score * 100).toFixed(1);
    document.getElementById('modalCurrentReason').innerText = decision.decision_reason;
    document.getElementById('decisionId').value = decisionId;
    document.getElementById('newResult').value = decision.final_result;
    document.getElementById('newConfidence').value = (decision.confidence_score * 100).toFixed(2);
    document.getElementById('newReason').value = decision.decision_reason;
  } else {
    document.getElementById('modalCurrentResult').innerText = 'No decision yet';
    document.getElementById('modalCurrentTirads').innerText = record ? record.tirads_score : 'N/A';
    document.getElementById('modalCurrentConfidence').innerText = '-';
    document.getElementById('modalCurrentReason').innerText = '-';
    document.getElementById('decisionId').value = '';
    document.getElementById('newResult').value = 'Benign';
    document.getElementById('newConfidence').value = '';
    document.getElementById('newReason').value = '';
  }
  modal.style.display = 'flex';
}

closeModal.onclick = () => modal.style.display = 'none';
window.onclick = (e) => { if (e.target == modal) modal.style.display = 'none'; };

// Update decision
updateForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const decisionId = document.getElementById('decisionId').value;
  const newResult = document.getElementById('newResult').value;
  const newConfidence = parseFloat(document.getElementById('newConfidence').value) / 100;
  const newReason = document.getElementById('newReason').value;

  try {
    if (!decisionId) {
      const newDecisionRef = db.ref('final_decisions').push();
      await newDecisionRef.set({
        patient_id: currentPatientId,
        decision_type: 'doctor_review',
        image_result_summary: '',
        clinical_result_summary: '',
        final_result: newResult,
        confidence_score: newConfidence,
        decision_reason: newReason,
        status: 'reviewed',
        created_at: new Date().toISOString()
      });
      Swal.fire('Success', 'Decision created successfully', 'success');
    } else {
      await db.ref('final_decisions/' + decisionId).update({
        final_result: newResult,
        confidence_score: newConfidence,
        decision_reason: newReason,
        status: 'reviewed'
      });
      Swal.fire('Success', 'Decision updated successfully', 'success');
    }
  } catch (error) {
    Swal.fire('Error', error.message, 'error');
  }
  modal.style.display = 'none';
  loadData(false);
});

// WhatsApp
sendWhatsAppBtn.addEventListener('click', () => {
  if (!currentPhone) return Swal.fire('No phone number', 'Patient has no phone number.', 'info');
  const patientName = document.getElementById('modalPatientName').innerText;
  const result = document.getElementById('newResult').value;
  const confidence = document.getElementById('newConfidence').value;
  const reason = document.getElementById('newReason').value;
  const message = `Dear ${patientName},\nYour thyroid diagnosis: ${result} with ${confidence}% confidence.\nDoctor's note: ${reason}`;
  const url = `https://wa.me/${currentPhone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
});

// Logout
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('doctorLoggedIn');
  localStorage.removeItem('doctorName');
  window.location.href = 'login.html';
});

// Refresh
refreshBtn.addEventListener('click', () => loadData(true));

// Export detailed CSV
function exportFilteredData() {
  const filtered = filterPatients();
  if (filtered.length === 0) {
    Swal.fire('No data', 'No patients match the current filters to export.', 'info');
    return;
  }

  const exportData = filtered.map(patient => {
    const record = allRecords.filter(r => r.patient_id === patient.id).sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
    const decision = allDecisions.filter(d => d.patient_id === patient.id).sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
    const image = allImages.filter(i => i.patient_id === patient.id).sort((a,b) => new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0))[0];
    return {
      'Patient ID': patient.id,
      'Full Name': patient.full_name || '',
      'Age': patient.age || '',
      'Gender': patient.gender || '',
      'Phone': patient.phone || '',
      'Medical History': patient.medical_history || '',
      'Smoking Status': patient.smoking_status || '',
      'TIRADS Score': record ? record.tirads_score : '',
      'Nodule Size': record ? record.nodule_size : '',
      'Symptoms': record ? record.symptoms_reported : '',
      'Risk Factors': record ? record.risk_factors : '',
      'Clinical Notes': record ? record.notes : '',
      'Final Result': decision ? decision.final_result : '',
      'Confidence (%)': decision ? (decision.confidence_score * 100).toFixed(1) : '',
      'Decision Reason': decision ? decision.decision_reason : '',
      'Decision Date': decision ? new Date(decision.created_at).toLocaleString() : '',
      'Image URL': image ? image.image_path : ''
    };
  });

  const headers = Object.keys(exportData[0]);
  const csvRows = [];
  csvRows.push(headers.join(','));
  for (const row of exportData) {
    const values = headers.map(header => {
      const val = row[header]?.toString().replace(/,/g, ';') || '';
      return `"${val}"`;
    });
    csvRows.push(values.join(','));
  }
  const csvString = csvRows.join('\n');
  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `patients_export_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
exportDataBtn.addEventListener('click', exportFilteredData);

// Download single patient card with detailed info
window.downloadPatientCard = function(patientId) {
  const patient = allPatients.find(p => p.id === patientId);
  if (!patient) return;
  const record = allRecords.filter(r => r.patient_id === patientId).sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
  const decision = allDecisions.filter(d => d.patient_id === patientId).sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
  const image = allImages.filter(i => i.patient_id === patientId).sort((a,b) => new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0))[0];

  const content = `
========================================
          PATIENT FULL REPORT
========================================
Patient ID: ${patient.id}
Full Name: ${patient.full_name || 'Unknown'}
Age: ${patient.age || ''}
Gender: ${patient.gender || ''}
Phone: ${patient.phone || 'N/A'}
Medical History: ${patient.medical_history || ''}
Smoking Status: ${patient.smoking_status || ''}
----------------------------------------
Clinical Record (Latest):
- TIRADS Score: ${record ? record.tirads_score : 'N/A'}
- Nodule Size: ${record ? record.nodule_size : ''}
- Symptoms Reported: ${record ? record.symptoms_reported : ''}
- Risk Factors: ${record ? record.risk_factors : ''}
- Notes: ${record ? record.notes : ''}
- Record Date: ${record ? new Date(record.created_at).toLocaleString() : ''}
----------------------------------------
Final Decision:
- Result: ${decision ? decision.final_result : 'Pending'}
- Confidence: ${decision ? (decision.confidence_score * 100).toFixed(1) : ''}%
- Reason: ${decision ? decision.decision_reason : ''}
- Decision Date: ${decision ? new Date(decision.created_at).toLocaleString() : ''}
----------------------------------------
Image URL: ${image ? image.image_path : 'No image'}
========================================
  `.trim();

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `patient_${patient.full_name || 'unknown'}_${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

// Time filter toggle
timeFilter.addEventListener('change', () => {
  if (timeFilter.value === 'custom') {
    customDateRange.style.display = 'flex';
  } else {
    customDateRange.style.display = 'none';
  }
  renderPatients();
});

// Filter listeners
[searchInput, resultFilter, tiradsFilter, timeFilter, dateFrom, dateTo].forEach(el => {
  if (el) el.addEventListener('input', renderPatients);
  if (el) el.addEventListener('change', renderPatients);
});

// Initial load
loadData(true);