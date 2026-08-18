CREATE INDEX "alertas_ativo_criado_idx" ON "alertas" USING btree ("ativo","criado_em");--> statement-breakpoint
CREATE INDEX "leituras_cod_ana_data_hora_idx" ON "leituras" USING btree ("cod_ana","data_hora");--> statement-breakpoint
CREATE INDEX "notificacoes_contato_ativo_idx" ON "notificacoes" USING btree ("contato","ativo");--> statement-breakpoint
CREATE INDEX "ocorrencias_inicio_idx" ON "ocorrencias" USING btree ("inicio");