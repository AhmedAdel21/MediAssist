import { Card } from '@/components/ui/Card'
import { DocumentUpload } from '@/components/documents/DocumentUpload'
import { DocumentList } from '@/components/documents/DocumentList'

export default function DocumentsPage() {
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Documents</h1>
        <p className="text-sm text-gray-500 mt-1">Upload medical protocols and guidelines for the AI to use</p>
      </div>

      <Card>
        <h2 className="text-base font-semibold text-gray-800 mb-4">Upload Document</h2>
        <DocumentUpload />
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-gray-800 mb-4">Document Library</h2>
        <DocumentList />
      </Card>
    </div>
  )
}
