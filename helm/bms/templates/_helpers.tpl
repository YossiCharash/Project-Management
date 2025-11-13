{{/*
Expand the name of the chart.
*/}}
{{- define "bms.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "bms.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "bms.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "bms.labels" -}}
helm.sh/chart: {{ include "bms.chart" . }}
{{ include "bms.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "bms.selectorLabels" -}}
app.kubernetes.io/name: {{ include "bms.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "bms.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "bms.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Frontend labels
*/}}
{{- define "bms.frontend.labels" -}}
helm.sh/chart: {{ include "bms.chart" . }}
{{ include "bms.frontend.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Frontend selector labels
*/}}
{{- define "bms.frontend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "bms.name" . }}-frontend
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Backend labels
*/}}
{{- define "bms.backend.labels" -}}
helm.sh/chart: {{ include "bms.chart" . }}
{{ include "bms.backend.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Backend selector labels
*/}}
{{- define "bms.backend.selectorLabels" -}}
app.kubernetes.io/name: {{ include "bms.name" . }}-backend
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Frontend fullname
*/}}
{{- define "bms.frontend.fullname" -}}
{{ include "bms.fullname" . }}-frontend
{{- end }}

{{/*
Backend fullname
*/}}
{{- define "bms.backend.fullname" -}}
{{ include "bms.fullname" . }}-backend
{{- end }}

{{/*
Frontend image
*/}}
{{- define "bms.frontend.image" -}}
{{- if .Values.frontend.image.tag }}
{{- printf "%s:%s" .Values.frontend.image.repository .Values.frontend.image.tag }}
{{- else }}
{{- printf "%s:latest" .Values.frontend.image.repository }}
{{- end }}
{{- end }}

{{/*
Backend image
*/}}
{{- define "bms.backend.image" -}}
{{- if .Values.backend.image.tag }}
{{- printf "%s:%s" .Values.backend.image.repository .Values.backend.image.tag }}
{{- else }}
{{- printf "%s:latest" .Values.backend.image.repository }}
{{- end }}
{{- end }}

{{/*
Common annotations
*/}}
{{- define "bms.annotations" -}}
meta.helm.sh/release-name: {{ .Release.Name }}
meta.helm.sh/release-namespace: {{ .Release.Namespace }}
{{- end }}