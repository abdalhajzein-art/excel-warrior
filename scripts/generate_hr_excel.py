# generate_hr_excel.py
"""
Script to generate an advanced Arabic RTL HR Excel workbook (HR_System.xlsx).

Requirements:
  pip install pandas xlsxwriter numpy

Usage:
  python generate_hr_excel.py

Output:
  HR_System.xlsx written to the current directory.

Notes:
 - This script builds sample data (20 employees) and creates tables, summary (pivot-like) summaries using pandas groupby,
   conditional formatting and several charts in a Dashboard sheet. It sets worksheets to right-to-left.
 - The generated file is .xlsx (no macros). Some Excel pivot-specific features are emulated with summary tables.

"""
import pandas as pd
import numpy as np
import datetime as dt
from collections import defaultdict

OUTPUT_FILE = 'HR_System.xlsx'
CURRENCY = 'SAR'
NUM_EMPLOYEES = 20
START_DATE = (dt.date.today().replace(day=1) - pd.DateOffset(months=11)).date()  # start 12 months ago
END_DATE = (dt.date.today()).date()

# Sample Arabic names and values
arabic_first_names = [
    'أحمد','محمد','علي','خالد','سلمان','يوسف','عمر','عبدالله','فيصل','فهد',
    'عبدالرحمن','سعيد','ناصر','هشام','طارق','ماهر','زياد','بدر','حسن','مصطفى'
]
departments = ['الموارد البشرية','تكنولوجيا المعلومات','المبيعات','المالية','العمليات']
positions = [
    ('مدير', 'عالي', 15000),
    ('أخصائي', 'متوسط', 7000),
    ('محاسب', 'متوسط', 8000),
    ('مبرمج', 'متوسط', 9000),
    ('مندوب مبيعات', 'مبتدئ', 5000),
]
leave_types = ['إجازة سنوية','إجازة مرضية','إجازة خاصة']

np.random.seed(1)

# Build Employees table
emp_rows = []
for i in range(NUM_EMPLOYEES):
    emp_id = 1000 + i
    name = arabic_first_names[i % len(arabic_first_names)] + ' ' + 'الاسم'
    dept = np.random.choice(departments)
    pos_choice = positions[np.random.randint(len(positions))]
    position, level, base_salary = pos_choice
    hire_date = (dt.date.today() - pd.DateOffset(days=np.random.randint(30, 2000))).date()
    contract_type = np.random.choice(['دوام كامل','جزئي','متعاقد'])
    status = np.random.choice(['قيد العمل','إجازة','مفصول'])
    manager = ''
    emp_rows.append({
        'رقم الموظف': emp_id,
        'الاسم': name,
        'القسم': dept,
        'المسمى الوظيفي': position,
        'المستوى': level,
        'الراتب الأساسي': base_salary,
        'تاريخ التوظيف': hire_date,
        'نوع العقد': contract_type,
        'الحالة': status,
        'المدير المباشر': manager,
        'رصيد الإجازات السنوي': 30  # days
    })

employees_df = pd.DataFrame(emp_rows)
# Assign managers (first employee in each department)
for dept in departments:
    members = employees_df[employees_df['القسم'] == dept]
    if not members.empty:
        mgr_index = members.index[0]
        mgr_id = employees_df.loc[mgr_index, 'رقم الموظف']
        employees_df.loc[employees_df['القسم'] == dept, 'المدير المباشر'] = mgr_id

# Build Positions and Departments tables
positions_df = pd.DataFrame([{ 'المسمى': p[0], 'المستوى': p[1], 'الراتب_الافتراضي': p[2]} for p in positions])
departments_df = pd.DataFrame([{ 'القسم': d, 'مدير': employees_df[employees_df['القسم']==d]['رقم الموظف'].iloc[0] if not employees_df[employees_df['القسم']==d].empty else '', 'ميزانية': np.random.randint(100000,500000)} for d in departments])

# Build Attendance table: create entries for each working day for last 12 months
date_range = pd.bdate_range(start=START_DATE, end=END_DATE)  # business days
att_rows = []
for single_date in date_range:
    for _, r in employees_df.iterrows():
        # Randomly sometimes absent
        absent = np.random.rand() < 0.03
        if absent:
            status = 'غائب'
            check_in = ''
            check_out = ''
            hours = 0
        else:
            # standard hours 9:00 - 17:00 with small random offset
            check_in_time = dt.time(hour=9, minute=int(np.random.normal(0,10)))
            check_out_time = dt.time(hour=17, minute=int(np.random.normal(0,10)))
            # sometimes do overtime
            ot = 0
            if np.random.rand() < 0.07:
                ot = np.random.choice([1,2,3,4])
            # compute hours
            h = 8 + ot
            check_in = check_in_time.strftime('%H:%M')
            check_out = (dt.datetime.combine(dt.date.today(), check_out_time) + dt.timedelta(hours=ot)).time().strftime('%H:%M')
            status = 'حاضر'
            hours = h
        att_rows.append({
            'التاريخ': single_date.date(),
            'رقم الموظف': r['رقم الموظف'],
            'اسم الموظف': r['الاسم'],
            'دخول': check_in,
            'خروج': check_out,
            'ساعات العمل': hours,
            'عمل إضافي': max(0, hours-8),
            'حالة': status
        })

attendance_df = pd.DataFrame(att_rows)

# Build Leaves table: random leave requests
leave_rows = []
for i in range(60):
    emp = employees_df.sample(1).iloc[0]
    start = (dt.date.today() - pd.DateOffset(days=np.random.randint(0,350))).date()
    length = np.random.randint(1,10)
    end = (pd.to_datetime(start) + pd.DateOffset(days=length-1)).date()
    lt = np.random.choice(leave_types)
    status = np.random.choice(['موافق','مرفوض','قيد الانتظار'], p=[0.7,0.1,0.2])
    leave_rows.append({'رقم الموظف': emp['رقم الموظف'], 'اسم الموظف': emp['الاسم'], 'نوع الإجازة': lt, 'من': start, 'إلى': end, 'عدد الأيام': length, 'الحالة': status})

leaves_df = pd.DataFrame(leave_rows)

# Build Recruitment sample
rec_rows = []
for i in range(15):
    candidate_name = 'مرشح ' + str(i+1)
    applied_for = positions[np.random.randint(len(positions))][0]
    applied_on = (dt.date.today() - pd.DateOffset(days=np.random.randint(1,400))).date()
    stage = np.random.choice(['مراجعة السيرة','مقابلة أولى','مقابلة تقنية','عرض وظيفي','مرفوض','تم التوظيف'])
    rec_rows.append({'الاسم': candidate_name, 'المسمى المتقدم له': applied_for, 'تاريخ التقديم': applied_on, 'المرحلة': stage})

recruitment_df = pd.DataFrame(rec_rows)

# Training sample
train_rows = []
for i in range(8):
    tname = 'برنامج تدريبي ' + str(i+1)
    date = (dt.date.today() - pd.DateOffset(days=np.random.randint(1,400))).date()
    participants = employees_df.sample(np.random.randint(3,8))['رقم الموظف'].tolist()
    cost = np.random.randint(1000,20000)
    status = np.random.choice(['مكتمل','مخطط','قيد التنفيذ'])
    train_rows.append({'اسم البرنامج': tname, 'تاريخ': date, 'مشاركين': ','.join(map(str,participants)), 'تكلفة': cost, 'الحالة': status})

training_df = pd.DataFrame(train_rows)

# Performance sample
perf_rows = []
criteria = ['الالتزام','الجودة','الانتاجية','العمل الجماعي']
for _, emp in employees_df.iterrows():
    for cycle in range(1,4):
        scores = {c: np.random.randint(60,100) for c in criteria}
        avg = np.mean(list(scores.values()))
        perf_rows.append({'رقم الموظف': emp['رقم الموظف'], 'اسم الموظف': emp['الاسم'], 'دورة': f'تقييم {cycle}', 'الالتزام': scores['الالتزام'], 'الجودة': scores['الجودة'], 'الانتاجية': scores['الانتاجية'], 'العمل الجماعي': scores['العمل الجماعي'], 'المعدل': avg})

performance_df = pd.DataFrame(perf_rows)

# Payroll: compute monthly payroll summaries for last 12 months
months = pd.date_range(start=START_DATE, end=END_DATE, freq='MS')
payroll_rows = []
for m in months:
    for _, emp in employees_df.iterrows():
        base = emp['الراتب الأساسي']
        allowance = int(base * np.random.uniform(0.05,0.25))
        deductions = int(base * np.random.uniform(0.01,0.05))
        social = int(base * 0.05)
        gross = base + allowance
        net = gross - deductions - social
        payroll_rows.append({'شهر': m.strftime('%Y-%m'), 'رقم الموظف': emp['رقم الموظف'], 'اسم الموظف': emp['الاسم'], 'الراتب_الاساسي': base, 'بدلات': allowance, 'الخصومات': deductions, 'الضمان_الاجتماعي': social, 'الإجمالي': gross, 'الصافي': net})

payroll_df = pd.DataFrame(payroll_rows)

# Summaries (pivot-like)
# توزيع الموظفين حسب القسم
emp_by_dept = employees_df.groupby('القسم').size().reset_index(name='عدد الموظفين')
# تكلفة الرواتب شهريًا
payroll_monthly = payroll_df.groupby('شهر')['الإجمالي','الصافي'].sum().reset_index()

# Build Excel with XlsxWriter
with pd.ExcelWriter(OUTPUT_FILE, engine='xlsxwriter') as writer:
    workbook = writer.book

    # Write sheets
    employees_df.to_excel(writer, sheet_name='الموظفون', index=False, startrow=0)
    departments_df.to_excel(writer, sheet_name='الأقسام', index=False, startrow=0)
    positions_df.to_excel(writer, sheet_name='المسميات', index=False, startrow=0)
    attendance_df.to_excel(writer, sheet_name='الحضور', index=False, startrow=0)
    leaves_df.to_excel(writer, sheet_name='الإجازات', index=False, startrow=0)
    recruitment_df.to_excel(writer, sheet_name='التوظيف', index=False, startrow=0)
    training_df.to_excel(writer, sheet_name='التدريب', index=False, startrow=0)
    performance_df.to_excel(writer, sheet_name='الأداء', index=False, startrow=0)
    payroll_df.to_excel(writer, sheet_name='الرواتب', index=False, startrow=0)

    # Summary sheets
    emp_by_dept.to_excel(writer, sheet_name='مُلخص الموظفين', index=False, startrow=0)
    payroll_monthly.to_excel(writer, sheet_name='مُلخص الرواتب', index=False, startrow=0)

    # Dashboard sheet with charts & summaries
    dashboard = workbook.add_worksheet('لوحة التحكم')
    # Set RTL
    for ws_name in ['الموظفون','الأقسام','المسميات','الحضور','الإجازات','التوظيف','التدريب','الأداء','الرواتب','مُلخص الموظفين','مُلخص الرواتب','لوحة التحكم']:
        try:
            ws = writer.sheets.get(ws_name)
            if ws is not None:
                ws.right_to_left()
        except Exception:
            # newly created dashboard worksheet not in writer.sheets
            pass
    # Write dashboard summary tables from dataframes
    # Employee counts by department
    dashboard.write_row(0, 0, ['القسم','عدد الموظفين'])
    for i, row in emp_by_dept.iterrows():
        dashboard.write(i+1, 0, row['القسم'])
        dashboard.write(i+1, 1, int(row['عدد الموظفين']))

    # Payroll monthly
    dashboard.write_row(0, 4, ['شهر','الإجمالي','الصافي'])
    for i, row in payroll_monthly.iterrows():
        dashboard.write(i+1, 4, row['شهر'])
        dashboard.write(i+1, 5, float(row['الإجمالي']))
        dashboard.write(i+1, 6, float(row['الصافي']))

    # Create charts
    chart1 = workbook.add_chart({'type': 'pie'})
    chart1.add_series({'name': 'توزيع الموظفين', 'categories': ['لوحة التحكم', 1, 0, len(emp_by_dept), 0], 'values': ['لوحة التحكم', 1, 1, len(emp_by_dept), 1]})
    chart1.set_title({'name': 'توزيع الموظفين حسب القسم'})
    dashboard.insert_chart('J2', chart1, {'x_scale': 1.3, 'y_scale': 1.3})

    chart2 = workbook.add_chart({'type': 'column'})
    chart2.add_series({'name': 'تكلفة الرواتب الإجمالية', 'categories': ['لوحة التحكم', 1, 4, len(payroll_monthly), 4], 'values': ['لوحة التحكم', 1, 5, len(payroll_monthly), 5]})
    chart2.set_title({'name': 'تكلفة الرواتب شهريًا'})
    chart2.set_x_axis({'name': 'شهر'})
    chart2.set_y_axis({'name': f'المبلغ ({CURRENCY})'})
    dashboard.insert_chart('B15', chart2, {'x_scale': 1.5, 'y_scale': 1.2})

    chart3 = workbook.add_chart({'type': 'line'})
    chart3.add_series({'name': 'صافي الرواتب', 'categories': ['لوحة التحكم', 1, 4, len(payroll_monthly), 4], 'values': ['لوحة التحكم', 1, 6, len(payroll_monthly), 6]})
    chart3.set_title({'name': 'صافي الرواتب شهريًا'})
    dashboard.insert_chart('B2', chart3, {'x_scale': 1.5, 'y_scale': 1.2})

    # Add README sheet
    readme_text = (
        'هذا المصنف نموذج نظام موارد بشرية متكامل بالعربي (RTL)\n'
        'الأوراق الموجودة:\n'
        '- الموظفون: بيانات الموظفين الأساسية\n'
        '- الأقسام: قائمة الأقسام\n'
        '- المسميات: الوظائف والرواتب الافتراضية\n'
        '- الحضور: سجلات حضور يومية (عينات)\n'
        '- الإجازات: طلبات الإجازة\n'
        '- التوظيف: مرشحين وحالاتهم\n'
        '- التدريب: برامج وتكاليف\n'
        '- الأداء: تقييمات الموظفين\n'
        '- الرواتب: رواتب شهرية ومكونات\n'
        '- لوحة التحكم: ملخصات ومخططات\n\n'
        'لتخصيص النموذج:\n'
        '- شغل الملف ثم عدل الجداول المرجعية (الأقسام، المسميات)\n'
        '- البيانات المنشأة هي عينات يمكنك استبدالها\n'
        '- لإنشاء PivotTables أصلية استخدم Excel Desktop وقم بإدراج PivotTable من جدول الرواتب أو الحضور\n'
    )
    rd_df = pd.DataFrame({'README': [readme_text]})
    rd_df.to_excel(writer, sheet_name='README-تعليمات', index=False)

print('تم إنشاء الملف:', OUTPUT_FILE)
