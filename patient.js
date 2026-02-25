window.addEventListener('load', function() {
  let width = 0;
  const splashProgress = document.getElementById('splashProgress');
  const splashScreen = document.getElementById('splash-screen');
  const mainContent = document.getElementById('main-content');
  
  const interval = setInterval(function() {
    if (width >= 100) {
      clearInterval(interval);
      splashScreen.style.opacity = '0';
      setTimeout(() => {
        splashScreen.style.display = 'none';
        mainContent.style.display = 'block';
        if (typeof AOS !== 'undefined') AOS.refresh();
      }, 500);
    } else {
      width += Math.random() * 15;
      if (width > 100) width = 100;
      splashProgress.style.width = width + '%';
    }
  }, 150);
});

// DOM elements
const startBtn = document.getElementById('startDiagnosisBtn');
const doctorLoginBtn = document.getElementById('doctorLoginBtn');
const diagnosisFlow = document.getElementById('diagnosisFlow');
const uploadSection = document.getElementById('upload-section');
const clinicalSection = document.getElementById('clinical-section');
const analysisSection = document.getElementById('analysis-section');
const resultSection = document.getElementById('result-section');
const uploadArea = document.getElementById('uploadArea');
const imageUpload = document.getElementById('imageUpload');
const uploadBtn = document.getElementById('uploadBtn');
const uploadStatus = document.getElementById('uploadStatus');
const clinicalForm = document.getElementById('clinicalForm');
const progress = document.getElementById('progress');
const stepLabels = document.querySelectorAll('.step-label');

// History elements
const previousResultsSection = document.getElementById('previousResultsSection');
const historyCardsContainer = document.getElementById('historyCardsContainer');
const noHistoryMessage = document.getElementById('noHistoryMessage');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const historySearch = document.getElementById('historySearch');
const historyResultFilter = document.getElementById('historyResultFilter');
const historyTiradsFilter = document.getElementById('historyTiradsFilter');

// Start Diagnosis button
startBtn.addEventListener('click', () => {
  diagnosisFlow.style.display = 'block';
  window.scrollTo({ top: diagnosisFlow.offsetTop - 80, behavior: 'smooth' });
  if (typeof AOS !== 'undefined') AOS.refresh();
});

doctorLoginBtn.addEventListener('click', () => {
  window.location.href = 'login.html';
});

// Upload area
uploadArea.addEventListener('click', () => imageUpload.click());
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.style.background = '#e6f3ff';
  uploadArea.style.borderColor = '#06445c';
});
uploadArea.addEventListener('dragleave', () => {
  uploadArea.style.background = '#f0f9ff';
  uploadArea.style.borderColor = 'var(--primary)';
});
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.style.background = '#f0f9ff';
  uploadArea.style.borderColor = 'var(--primary)';
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    imageUpload.files = e.dataTransfer.files;
    uploadBtn.disabled = false;
    uploadStatus.innerHTML = `<i class="fas fa-check-circle" style="color:green;"></i> File selected: ${file.name}`;
  } else {
    Swal.fire('Error', 'Please drop an image file.', 'error');
  }
});

imageUpload.addEventListener('change', () => {
  uploadBtn.disabled = !imageUpload.files.length;
  if (imageUpload.files.length) {
    uploadStatus.innerHTML = `<i class="fas fa-check-circle" style="color:green;"></i> File selected: ${imageUpload.files[0].name}`;
  }
});

// Global vars
let currentPatientId = null;
let currentImageId = null;
let currentRecordId = null;

// Upload to Cloudinary
uploadBtn.addEventListener('click', async () => {
  const file = imageUpload.files[0];
  if (!file) return;
  uploadStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  try {
    const res = await fetch(CLOUDINARY_URL, { method: 'POST', body: formData });
    const data = await res.json();
    const imageUrl = data.secure_url;

    // Create patient
    const patientRef = db.ref('patients').push();
    currentPatientId = patientRef.key;
    await patientRef.set({
      full_name: '',
      age: 0,
      gender: '',
      phone: '',
      medical_history: '',
      smoking_status: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Save image
    const imageRef = db.ref('ultrasound_images').push();
    currentImageId = imageRef.key;
    await imageRef.set({
      patient_id: currentPatientId,
      image_path: imageUrl,
      image_type: file.type,
      resolution: 'unknown',
      capture_date: new Date().toISOString(),
      uploaded_at: new Date().toISOString(),
      processed_image_array: ''
    });

    progress.style.width = '25%';
    stepLabels[0].classList.add('active');
    stepLabels[1].classList.add('active');
    uploadSection.style.display = 'none';
    clinicalSection.style.display = 'block';
    if (typeof AOS !== 'undefined') AOS.refresh();
  } catch (err) {
    console.error(err);
    uploadStatus.innerHTML = '<span style="color:red;">Upload failed. Try again.</span>';
    Swal.fire('Upload Failed', 'Could not upload image. Please try again.', 'error');
  }
});

// Submit clinical form
clinicalForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const fullName = document.getElementById('fullName').value;
  const age = parseInt(document.getElementById('age').value);
  const gender = document.getElementById('gender').value;
  const phone = document.getElementById('phone').value;
  const medicalHistory = document.getElementById('medicalHistory').value;
  const smokingStatus = document.getElementById('smokingStatus').value;
  const tiradsScore = parseInt(document.getElementById('tiradsScore').value);
  const noduleSize = document.getElementById('noduleSize').value;
  const symptoms = document.getElementById('symptoms').value;
  const riskFactors = document.getElementById('riskFactors').value;
  const notes = document.getElementById('notes').value;
  const recordedBy = document.getElementById('recordedBy').value;

  // Update patient
  await db.ref('patients/' + currentPatientId).update({
    full_name: fullName,
    age: age,
    gender: gender,
    phone: phone,
    medical_history: medicalHistory,
    smoking_status: smokingStatus,
    updated_at: new Date().toISOString()
  });

  // Create clinical record with TIRADS
  const recordRef = db.ref('clinical_records').push();
  currentRecordId = recordRef.key;
  await recordRef.set({
    patient_id: currentPatientId,
    tirads_score: tiradsScore,
    nodule_size: noduleSize,
    symptoms_reported: symptoms,
    risk_factors: riskFactors,
    notes: notes,
    recorded_by: recordedBy,
    created_at: new Date().toISOString()
  });

  progress.style.width = '50%';
  stepLabels[2].classList.add('active');
  clinicalSection.style.display = 'none';
  analysisSection.style.display = 'block';

  // بدء المحاكاة الذكية
  simulateAnalysis(symptoms, tiradsScore, noduleSize, riskFactors, fullName, phone, medicalHistory, smokingStatus, age, gender);
});

// دالة محاكاة تحليل الصورة بشكل واقعي
function simulateImageAnalysis() {
  // محاكاة استخراج خصائص الصورة 
  const composition = ['Cystic', 'Solid', 'Mixed'][Math.floor(Math.random() * 3)];
  const echogenicity = ['Anechoic', 'Hypoechoic', 'Isoechoic', 'Hyperechoic'][Math.floor(Math.random() * 4)];
  const shape = ['Oval', 'Irregular', 'Lobulated'][Math.floor(Math.random() * 3)];
  const margin = ['Smooth', 'Ill-defined', 'Spiculated'][Math.floor(Math.random() * 3)];
  const foci = ['None', 'Macrocalcifications', 'Microcalcifications'][Math.floor(Math.random() * 3)];

  // حساب TIRADS بناءً على الخصائص (قواعد مبسطة)
  let tiradsFromImage = 3; // افتراضي
  if (composition === 'Solid' && echogenicity === 'Hypoechoic' && shape === 'Irregular' && margin === 'Spiculated' && foci === 'Microcalcifications') {
    tiradsFromImage = 5;
  } else if (composition === 'Solid' && echogenicity === 'Hypoechoic' && (margin === 'Ill-defined' || foci !== 'None')) {
    tiradsFromImage = 4;
  } else if (composition === 'Mixed' || echogenicity === 'Isoechoic') {
    tiradsFromImage = 3;
  } else {
    tiradsFromImage = 2;
  }

  // إضافة بعض العشوائية الواقعية
  tiradsFromImage = Math.min(5, Math.max(1, tiradsFromImage + Math.floor(Math.random() * 2) - 1));

  // تحديد النتيجة بناءً على TIRADS
  let result, confidence;
  if (tiradsFromImage >= 4) {
    result = Math.random() > 0.15 ? 'Malignant' : 'Benign';
    confidence = 0.75 + Math.random() * 0.2;
  } else if (tiradsFromImage === 3) {
    result = Math.random() > 0.5 ? 'Suspicious' : 'Benign';
    confidence = 0.6 + Math.random() * 0.25;
  } else {
    result = Math.random() > 0.1 ? 'Benign' : 'Malignant';
    confidence = 0.8 + Math.random() * 0.15;
  }

  return {
    tiradsFromImage,
    imageResult: result,
    imageConfidence: confidence,
    features: { composition, echogenicity, shape, margin, foci }
  };
}

// دالة محاكاة التحليل السريري
function simulateClinicalAnalysis(symptoms, tiradsScore, noduleSize, riskFactors, medicalHistory, smokingStatus, age, gender) {
  let clinicalResult, clinicalConfidence, reasons = [];

  // قائمة الأعراض الخطيرة
  const alarmingSymptoms = ['weight loss', 'lump', 'pain', 'hoarseness', 'difficulty swallowing'];
  const hasAlarming = alarmingSymptoms.some(s => symptoms.toLowerCase().includes(s));

  // عوامل الخطر
  let riskScore = 0;
  if (tiradsScore >= 4) riskScore += 3;
  else if (tiradsScore === 3) riskScore += 1;
  if (hasAlarming) riskScore += 2;
  if (riskFactors.toLowerCase().includes('family history')) riskScore += 1;
  if (smokingStatus === 'Current') riskScore += 1;
  if (age > 50) riskScore += 1;
  if (gender === 'Male') riskScore += 0.5; // الرجال أقل عرضة لكن خطر أكبر

  // استخراج حجم العقدة رقمياً
  const sizeMatch = noduleSize.match(/(\d+(\.\d+)?)/);
  const size = sizeMatch ? parseFloat(sizeMatch[0]) : 0;
  if (size > 2.5) riskScore += 1;

  if (riskScore >= 5) {
    clinicalResult = 'Malignant';
    clinicalConfidence = 0.8 + Math.random() * 0.15;
    reasons.push('High risk clinical profile.');
  } else if (riskScore >= 3) {
    clinicalResult = 'Suspicious';
    clinicalConfidence = 0.65 + Math.random() * 0.2;
    reasons.push('Moderate clinical risk factors.');
  } else {
    clinicalResult = 'Benign';
    clinicalConfidence = 0.7 + Math.random() * 0.2;
    reasons.push('Low clinical risk.');
  }

  return {
    clinicalResult,
    clinicalConfidence,
    reasons: reasons.join(' ')
  };
}

// المحاكاة الرئيسية
async function simulateAnalysis(symptoms, tiradsScore, noduleSize, riskFactors, fullName, phone, medicalHistory, smokingStatus, age, gender) {
  // محاكاة تحليل الصورة
  const { tiradsFromImage, imageResult, imageConfidence, features } = simulateImageAnalysis();

  // تخزين prediction الصورة
  const imagePredRef = db.ref('image_predictions').push();
  await imagePredRef.set({
    image_id: currentImageId,
    model_name: 'EfficientNet-B0 (Thyroid)',
    model_version: '2.1',
    result: imageResult,
    confidence: parseFloat(imageConfidence.toFixed(2)),
    gradcam_image: 'https://via.placeholder.com/300x200?text=Grad-CAM', // صورة توضيحية
    inference_time_ms: Math.floor(Math.random() * 500 + 200),
    extracted_features: JSON.stringify(features),
    created_at: new Date().toISOString()
  });

  // تحليل سريري
  const { clinicalResult, clinicalConfidence, reasons: clinicalReasons } = simulateClinicalAnalysis(
    symptoms, tiradsScore, noduleSize, riskFactors, medicalHistory, smokingStatus, age, gender
  );

  const clinicalPredRef = db.ref('clinical_predictions').push();
  await clinicalPredRef.set({
    record_id: currentRecordId,
    result: clinicalResult,
    confidence: parseFloat(clinicalConfidence.toFixed(2)),
    reasons: clinicalReasons,
    created_at: new Date().toISOString()
  });

  // دمج النتائج (Fusion)
  let finalResult, finalConfidence, decisionReason;
  const imageIsMalignant = imageResult === 'Malignant' || imageResult === 'Suspicious';
  const clinicalIsMalignant = clinicalResult === 'Malignant' || clinicalResult === 'Suspicious';

  if (imageIsMalignant && clinicalIsMalignant) {
    finalResult = 'Malignant';
    finalConfidence = (imageConfidence + clinicalConfidence) / 2;
    decisionReason = 'Both imaging and clinical data indicate malignancy.';
  } else if (!imageIsMalignant && !clinicalIsMalignant) {
    finalResult = 'Benign';
    finalConfidence = (imageConfidence + clinicalConfidence) / 2;
    decisionReason = 'Both imaging and clinical data suggest benign nature.';
  } else {
    finalResult = 'Inconclusive';
    finalConfidence = 0.5 + Math.random() * 0.2;
    decisionReason = 'Conflicting results; recommend further tests (biopsy).';
  }

  // تخزين القرار النهائي
  const decisionRef = db.ref('final_decisions').push();
  await decisionRef.set({
    patient_id: currentPatientId,
    decision_type: 'fusion',
    image_result_summary: `Image: ${imageResult} (${(imageConfidence*100).toFixed(1)}%) - Features: ${JSON.stringify(features)}`,
    clinical_result_summary: `Clinical: ${clinicalResult} (${(clinicalConfidence*100).toFixed(1)}%)`,
    final_result: finalResult,
    confidence_score: parseFloat(finalConfidence.toFixed(2)),
    decision_reason: decisionReason,
    status: 'final',
    created_at: new Date().toISOString()
  });

  progress.style.width = '100%';
  stepLabels[3].classList.add('active');
  analysisSection.style.display = 'none';
  resultSection.style.display = 'block';

  document.getElementById('resultContent').innerHTML = `
    <p><strong>Final Diagnosis:</strong> <span class="badge ${finalResult === 'Malignant' ? 'malignant' : finalResult === 'Benign' ? 'benign' : 'pending'}">${finalResult}</span></p>
    <p><strong>TIRADS Score (Clinical):</strong> <span class="tirads-badge tirads-${tiradsScore}">TIRADS ${tiradsScore}</span></p>
    <p><strong>TIRADS from Image:</strong> <span class="tirads-badge tirads-${tiradsFromImage}">TIRADS ${tiradsFromImage}</span></p>
    <p><strong>Confidence:</strong> ${(finalConfidence * 100).toFixed(1)}%</p>
    <p><strong>Reason:</strong> ${decisionReason}</p>
    <hr style="margin:15px 0;">
    <p><strong>Image Analysis:</strong> ${imageResult} (${(imageConfidence*100).toFixed(1)}%)<br>
    <small>Features: ${features.composition}, ${features.echogenicity}, ${features.shape}, ${features.margin}, ${features.foci}</small></p>
    <p><strong>Clinical Analysis:</strong> ${clinicalResult} (${(clinicalConfidence*100).toFixed(1)}%)</p>
  `;

  // تحميل الأدوية المقترحة
  await loadDrugSuggestions(symptoms, finalResult, tiradsScore);

  // حفظ في التاريخ المحلي
  saveToLocalHistory({
    patientId: currentPatientId,
    fullName: fullName,
    phone: phone,
    finalResult: finalResult,
    confidence: (finalConfidence * 100).toFixed(1),
    tiradsScore: tiradsScore,
    date: new Date().toISOString(),
    imageUrl: await getImageUrl(currentImageId),
    symptoms: symptoms,
    noduleSize: noduleSize,
    riskFactors: riskFactors
  });

  loadLocalHistory();
}

async function getImageUrl(imageId) {
  const snap = await db.ref('ultrasound_images/' + imageId).once('value');
  const img = snap.val();
  return img ? img.image_path : null;
}

// تحسين اقتراح الأدوية بناءً على الأعراض والتشخيص
async function loadDrugSuggestions(symptoms, finalResult, tiradsScore) {
  // قاعدة بيانات أدوية موسعة (يمكن تخزينها في Firebase لاحقاً)
  const drugsDatabase = [
    { name: 'Levothyroxine', description: 'Thyroid hormone replacement', treats: 'hypothyroidism', for_malignant: false, symptoms: 'fatigue,weight gain' },
    { name: 'Methimazole', description: 'Antithyroid medication', treats: 'hyperthyroidism', for_malignant: false, symptoms: 'weight loss,anxiety' },
    { name: 'Radioactive Iodine', description: 'Destroys overactive thyroid cells', treats: 'hyperthyroidism, thyroid cancer', for_malignant: true, symptoms: 'weight loss' },
    { name: 'Sorafenib', description: 'Tyrosine kinase inhibitor for advanced thyroid cancer', treats: 'thyroid cancer', for_malignant: true, symptoms: '' },
    { name: 'Lenvatinib', description: 'Kinase inhibitor for differentiated thyroid cancer', treats: 'thyroid cancer', for_malignant: true, symptoms: '' },
    { name: 'Doxorubicin', description: 'Chemotherapy for anaplastic thyroid cancer', treats: 'thyroid cancer', for_malignant: true, symptoms: '' },
    { name: 'Propranolol', description: 'Beta-blocker for hyperthyroidism symptoms', treats: 'hyperthyroidism', for_malignant: false, symptoms: 'anxiety,tachycardia' },
    { name: 'Prednisone', description: 'Steroid for thyroid eye disease or inflammation', treats: 'inflammation', for_malignant: false, symptoms: 'pain' }
  ];

  const symptomLower = symptoms.toLowerCase();
  let html = '';
  drugsDatabase.forEach(drug => {
    let match = false;
    if (drug.symptoms && drug.symptoms.toLowerCase().includes(symptomLower)) match = true;
    if (drug.treats && symptomLower.includes(drug.treats.toLowerCase())) match = true;
    if (finalResult === 'Malignant' && drug.for_malignant) match = true;
    if (tiradsScore >= 4 && drug.for_malignant) match = true; // TIRADS عالي قد يستدعي علاجاً للأورام
    if (match) {
      html += `
        <div class="drug-item">
          <strong>${drug.name}</strong><br>
          <small>${drug.description || ''}</small><br>
          <span style="font-size:0.9rem;">Dosage: As directed by physician</span>
        </div>
      `;
    }
  });
  document.getElementById('drugSuggestions').innerHTML = html || '<p>No specific medications suggested. Consult an endocrinologist.</p>';
}

// ========== Local Storage History with Filters ==========
const HISTORY_KEY = 'thyroid_diagnoses_history';

function saveToLocalHistory(entry) {
  let history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  history.unshift(entry);
  if (history.length > 20) history.pop();
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function loadLocalHistory() {
  let history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  const searchTerm = historySearch ? historySearch.value.toLowerCase() : '';
  const resultFilter = historyResultFilter ? historyResultFilter.value : 'all';
  const tiradsFilter = historyTiradsFilter ? historyTiradsFilter.value : 'all';

  let filtered = history.filter(item => {
    if (searchTerm && !(item.fullName && item.fullName.toLowerCase().includes(searchTerm))) return false;
    if (resultFilter !== 'all' && item.finalResult !== resultFilter) return false;
    if (tiradsFilter !== 'all' && item.tiradsScore != tiradsFilter) return false;
    return true;
  });

  if (filtered.length === 0) {
    historyCardsContainer.innerHTML = '';
    noHistoryMessage.style.display = 'block';
    return;
  }

  noHistoryMessage.style.display = 'none';
  let html = '';
  filtered.forEach((item, index) => {
    const tiradsClass = `tirads-${item.tiradsScore}`;
    html += `
      <div class="history-card" data-aos="fade-up" data-aos-delay="${index * 50}">
        <img src="${item.imageUrl || 'https://via.placeholder.com/300x200?text=No+Image'}" alt="Ultrasound" loading="lazy">
        <div class="card-content">
          <div class="card-header">
            <span class="patient-name">${item.fullName || 'Unknown'}</span>
            <div class="actions">
              <i class="fas fa-eye action-icon" onclick='showHistoryDetail("${index}")' title="View details"></i>
              <i class="fas fa-download action-icon" onclick='downloadHistoryItem("${index}")' title="Download"></i>
              <button class="delete-history" data-index="${index}"><i class="fas fa-trash-alt"></i></button>
            </div>
          </div>
          <div>
            <span class="badge ${item.finalResult === 'Malignant' ? 'malignant' : item.finalResult === 'Benign' ? 'benign' : 'pending'}">${item.finalResult}</span>
            <span class="tirads-badge ${tiradsClass}">TIRADS ${item.tiradsScore}</span>
          </div>
          <p><strong>Confidence:</strong> ${item.confidence}%</p>
          <p class="date"><i class="far fa-calendar-alt"></i> ${new Date(item.date).toLocaleDateString()}</p>
        </div>
      </div>
    `;
  });
  historyCardsContainer.innerHTML = html;

  document.querySelectorAll('.delete-history').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = btn.dataset.index;
      deleteHistoryItem(index);
    });
  });
}

function deleteHistoryItem(index) {
  Swal.fire({
    title: 'Remove from history?',
    text: 'This will only remove from your local history, not from the database.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Yes, remove'
  }).then((result) => {
    if (result.isConfirmed) {
      let history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
      history.splice(index, 1);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      loadLocalHistory();
      Swal.fire('Removed!', 'Entry removed from history.', 'success');
    }
  });
}

clearHistoryBtn.addEventListener('click', () => {
  if (JSON.parse(localStorage.getItem(HISTORY_KEY))?.length > 0) {
    Swal.fire({
      title: 'Clear all history?',
      text: 'This action cannot be undone.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, clear all'
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.removeItem(HISTORY_KEY);
        loadLocalHistory();
        Swal.fire('Cleared!', 'All local history removed.', 'success');
      }
    });
  } else {
    Swal.fire('No history', 'There is no history to clear.', 'info');
  }
});

window.showHistoryDetail = function(index) {
  let history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  const item = history[index];
  if (!item) return;
  const tiradsClass = `tirads-${item.tiradsScore}`;
  
  Swal.fire({
    title: item.fullName || 'Patient Details',
    html: `
      <div class="history-detail-modal">
        ${item.imageUrl ? `<img src="${item.imageUrl}" class="detail-image" alt="Ultrasound">` : ''}
        <div class="detail-info">
          <div class="info-row"><span class="info-label">Name:</span><span class="info-value">${item.fullName || 'Unknown'}</span></div>
          <div class="info-row"><span class="info-label">Phone:</span><span class="info-value">${item.phone || 'N/A'}</span></div>
          <div class="info-row"><span class="info-label">Diagnosis:</span><span class="info-value"><span class="badge ${item.finalResult === 'Malignant' ? 'malignant' : item.finalResult === 'Benign' ? 'benign' : 'pending'}">${item.finalResult}</span></span></div>
          <div class="info-row"><span class="info-label">TIRADS:</span><span class="info-value"><span class="tirads-badge ${tiradsClass}">TIRADS ${item.tiradsScore}</span></span></div>
          <div class="info-row"><span class="info-label">Confidence:</span><span class="info-value">${item.confidence}%</span></div>
          <div class="info-row"><span class="info-label">Symptoms:</span><span class="info-value">${item.symptoms || 'None'}</span></div>
          <div class="info-row"><span class="info-label">Nodule Size:</span><span class="info-value">${item.noduleSize || 'N/A'}</span></div>
          <div class="info-row"><span class="info-label">Risk Factors:</span><span class="info-value">${item.riskFactors || 'None'}</span></div>
          <div class="info-row"><span class="info-label">Date:</span><span class="info-value">${new Date(item.date).toLocaleString()}</span></div>
        </div>
      </div>
    `,
    confirmButtonText: 'Close',
    confirmButtonColor: '#085878',
    customClass: {
      popup: 'history-detail-modal'
    }
  });
};

// تحميل تفاصيل التاريخ كنص مفصل
window.downloadHistoryItem = function(index) {
  let history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  const item = history[index];
  if (!item) return;
  const content = `
========================================
            PATIENT REPORT
========================================
Full Name: ${item.fullName || 'Unknown'}
Phone: ${item.phone || 'N/A'}
Date of Diagnosis: ${new Date(item.date).toLocaleString()}
----------------------------------------
Clinical Information:
- TIRADS Score: ${item.tiradsScore}
- Nodule Size: ${item.noduleSize || 'Not specified'}
- Symptoms: ${item.symptoms || 'None'}
- Risk Factors: ${item.riskFactors || 'None'}
----------------------------------------
AI Diagnosis:
- Final Result: ${item.finalResult}
- Confidence: ${item.confidence}%
----------------------------------------
Image: ${item.imageUrl || 'No image available'}
========================================
  `.trim();
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `patient_${item.fullName || 'unknown'}_${new Date(item.date).toISOString().slice(0,10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

// Filter listeners
if (historySearch && historyResultFilter && historyTiradsFilter) {
  [historySearch, historyResultFilter, historyTiradsFilter].forEach(el => {
    el.addEventListener('input', loadLocalHistory);
    el.addEventListener('change', loadLocalHistory);
  });
}

// Initial load
loadLocalHistory();