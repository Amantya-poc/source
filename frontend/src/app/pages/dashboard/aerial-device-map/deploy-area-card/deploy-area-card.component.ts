import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-deploy-area-card',
  imports: [ButtonModule, TooltipModule],
  templateUrl: './deploy-area-card.component.html',
  styleUrl: './deploy-area-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeployAreaCardComponent {
  @Input() activeAction: string | null = null;

  @Output() deleteArea = new EventEmitter<void>();
  @Output() moveArea = new EventEmitter<void>();
  @Output() resizeArea = new EventEmitter<void>();
  @Output() reshapeArea = new EventEmitter<void>();
  @Output() closeArea = new EventEmitter<void>();
}
