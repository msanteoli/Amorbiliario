import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Hammer } from 'lucide-react'

interface UnderConstructionPageProps {
  title: string
}

export function UnderConstructionPage({ title }: UnderConstructionPageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-medium text-muted-foreground">
            <Hammer className="h-5 w-5" />
            Em construção
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Em construção</p>
        </CardContent>
      </Card>
    </div>
  )
}
