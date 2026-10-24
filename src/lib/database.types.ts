export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bagan_tanpa_jobdesk: {
        Row: {
          file_sumber: string
          id: number
          label: string
          unit_kerja_id: number
          urutan: number
        }
        Insert: {
          file_sumber: string
          id?: never
          label: string
          unit_kerja_id: number
          urutan?: number
        }
        Update: {
          file_sumber?: string
          id?: never
          label?: string
          unit_kerja_id?: number
          urutan?: number
        }
        Relationships: [
          {
            foreignKeyName: "bagan_tanpa_jobdesk_unit_kerja_id_fkey"
            columns: ["unit_kerja_id"]
            isOneToOne: false
            referencedRelation: "unit_kerja"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bagan_tanpa_jobdesk_unit_kerja_id_fkey"
            columns: ["unit_kerja_id"]
            isOneToOne: false
            referencedRelation: "v_jabatan"
            referencedColumns: ["unit_kerja_id"]
          },
        ]
      }
      bidang_kompetensi: {
        Row: {
          file_sumber: string | null
          id: number
          kategori: string
          kode: string
          nama: string
          urutan: number
        }
        Insert: {
          file_sumber?: string | null
          id?: never
          kategori: string
          kode: string
          nama: string
          urutan?: number
        }
        Update: {
          file_sumber?: string | null
          id?: never
          kategori?: string
          kode?: string
          nama?: string
          urutan?: number
        }
        Relationships: []
      }
      indikator_perilaku: {
        Row: {
          deskripsi: string
          id: number
          kompetensi_level_id: number
          urutan: number
        }
        Insert: {
          deskripsi: string
          id?: never
          kompetensi_level_id: number
          urutan: number
        }
        Update: {
          deskripsi?: string
          id?: never
          kompetensi_level_id?: number
          urutan?: number
        }
        Relationships: [
          {
            foreignKeyName: "indikator_perilaku_kompetensi_level_id_fkey"
            columns: ["kompetensi_level_id"]
            isOneToOne: false
            referencedRelation: "kompetensi_level"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indikator_perilaku_kompetensi_level_id_fkey"
            columns: ["kompetensi_level_id"]
            isOneToOne: false
            referencedRelation: "v_level_indikator"
            referencedColumns: ["id"]
          },
        ]
      }
      jabatan: {
        Row: {
          atasan_id: number | null
          catatan: string | null
          created_at: string
          diubah_di_aplikasi: string | null
          id: number
          ikhtisar_jabatan: string | null
          jenjang: number
          kelompok_jabatan: string
          kode: string
          nama: string
          nama_asli: string | null
          unit_kerja_id: number
          updated_at: string
          uraian_tugas: string[]
          urutan: number
        }
        Insert: {
          atasan_id?: number | null
          catatan?: string | null
          created_at?: string
          diubah_di_aplikasi?: string | null
          id?: never
          ikhtisar_jabatan?: string | null
          jenjang: number
          kelompok_jabatan: string
          kode: string
          nama: string
          nama_asli?: string | null
          unit_kerja_id: number
          updated_at?: string
          uraian_tugas?: string[]
          urutan?: number
        }
        Update: {
          atasan_id?: number | null
          catatan?: string | null
          created_at?: string
          diubah_di_aplikasi?: string | null
          id?: never
          ikhtisar_jabatan?: string | null
          jenjang?: number
          kelompok_jabatan?: string
          kode?: string
          nama?: string
          nama_asli?: string | null
          unit_kerja_id?: number
          updated_at?: string
          uraian_tugas?: string[]
          urutan?: number
        }
        Relationships: [
          {
            foreignKeyName: "jabatan_atasan_id_fkey"
            columns: ["atasan_id"]
            isOneToOne: false
            referencedRelation: "jabatan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jabatan_atasan_id_fkey"
            columns: ["atasan_id"]
            isOneToOne: false
            referencedRelation: "v_jabatan"
            referencedColumns: ["atasan_id"]
          },
          {
            foreignKeyName: "jabatan_atasan_id_fkey"
            columns: ["atasan_id"]
            isOneToOne: false
            referencedRelation: "v_jabatan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jabatan_atasan_id_fkey"
            columns: ["atasan_id"]
            isOneToOne: false
            referencedRelation: "v_jabatan_kompetensi"
            referencedColumns: ["jabatan_id"]
          },
          {
            foreignKeyName: "jabatan_atasan_id_fkey"
            columns: ["atasan_id"]
            isOneToOne: false
            referencedRelation: "v_jobdesk"
            referencedColumns: ["jabatan_id"]
          },
          {
            foreignKeyName: "jabatan_atasan_id_fkey"
            columns: ["atasan_id"]
            isOneToOne: false
            referencedRelation: "v_profil_jabatan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jabatan_atasan_id_fkey"
            columns: ["atasan_id"]
            isOneToOne: false
            referencedRelation: "v_review_jabatan"
            referencedColumns: ["jabatan_id"]
          },
          {
            foreignKeyName: "jabatan_unit_kerja_id_fkey"
            columns: ["unit_kerja_id"]
            isOneToOne: false
            referencedRelation: "unit_kerja"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jabatan_unit_kerja_id_fkey"
            columns: ["unit_kerja_id"]
            isOneToOne: false
            referencedRelation: "v_jabatan"
            referencedColumns: ["unit_kerja_id"]
          },
        ]
      }
      jabatan_kompetensi: {
        Row: {
          bukti: number[]
          catatan: string | null
          created_at: string
          id: number
          jabatan_id: number
          kompetensi_id: number
          level_target: number
          metode: string | null
          skor: number | null
          sumber: string
        }
        Insert: {
          bukti?: number[]
          catatan?: string | null
          created_at?: string
          id?: never
          jabatan_id: number
          kompetensi_id: number
          level_target: number
          metode?: string | null
          skor?: number | null
          sumber?: string
        }
        Update: {
          bukti?: number[]
          catatan?: string | null
          created_at?: string
          id?: never
          jabatan_id?: number
          kompetensi_id?: number
          level_target?: number
          metode?: string | null
          skor?: number | null
          sumber?: string
        }
        Relationships: [
          {
            foreignKeyName: "jabatan_kompetensi_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "jabatan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jabatan_kompetensi_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "v_jabatan"
            referencedColumns: ["atasan_id"]
          },
          {
            foreignKeyName: "jabatan_kompetensi_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "v_jabatan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jabatan_kompetensi_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "v_jabatan_kompetensi"
            referencedColumns: ["jabatan_id"]
          },
          {
            foreignKeyName: "jabatan_kompetensi_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "v_jobdesk"
            referencedColumns: ["jabatan_id"]
          },
          {
            foreignKeyName: "jabatan_kompetensi_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "v_profil_jabatan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jabatan_kompetensi_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "v_review_jabatan"
            referencedColumns: ["jabatan_id"]
          },
          {
            foreignKeyName: "jabatan_kompetensi_kompetensi_id_fkey"
            columns: ["kompetensi_id"]
            isOneToOne: false
            referencedRelation: "kompetensi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jabatan_kompetensi_kompetensi_id_fkey"
            columns: ["kompetensi_id"]
            isOneToOne: false
            referencedRelation: "v_jabatan_kompetensi"
            referencedColumns: ["kompetensi_id"]
          },
          {
            foreignKeyName: "jabatan_kompetensi_kompetensi_id_fkey"
            columns: ["kompetensi_id"]
            isOneToOne: false
            referencedRelation: "v_kompetensi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jabatan_kompetensi_kompetensi_id_fkey"
            columns: ["kompetensi_id"]
            isOneToOne: false
            referencedRelation: "v_kompetensi_pemakaian"
            referencedColumns: ["id"]
          },
        ]
      }
      jobdesk: {
        Row: {
          atasan_langsung: string | null
          created_at: string
          diubah_di_aplikasi: string | null
          file_sumber: string | null
          fungsi: string[]
          id: number
          jabatan_id: number | null
          kelompok_unit: string
          kode_dokumen: string | null
          kompetensi: string | null
          membawahi: string[]
          nama_jabatan: string
          pangkat: string | null
          pendidikan: string | null
          pendidikan_tambahan: string | null
          pengalaman_kerja: string | null
          updated_at: string
          urutan: number
        }
        Insert: {
          atasan_langsung?: string | null
          created_at?: string
          diubah_di_aplikasi?: string | null
          file_sumber?: string | null
          fungsi?: string[]
          id?: never
          jabatan_id?: number | null
          kelompok_unit: string
          kode_dokumen?: string | null
          kompetensi?: string | null
          membawahi?: string[]
          nama_jabatan: string
          pangkat?: string | null
          pendidikan?: string | null
          pendidikan_tambahan?: string | null
          pengalaman_kerja?: string | null
          updated_at?: string
          urutan?: number
        }
        Update: {
          atasan_langsung?: string | null
          created_at?: string
          diubah_di_aplikasi?: string | null
          file_sumber?: string | null
          fungsi?: string[]
          id?: never
          jabatan_id?: number | null
          kelompok_unit?: string
          kode_dokumen?: string | null
          kompetensi?: string | null
          membawahi?: string[]
          nama_jabatan?: string
          pangkat?: string | null
          pendidikan?: string | null
          pendidikan_tambahan?: string | null
          pengalaman_kerja?: string | null
          updated_at?: string
          urutan?: number
        }
        Relationships: [
          {
            foreignKeyName: "jobdesk_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "jabatan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobdesk_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "v_jabatan"
            referencedColumns: ["atasan_id"]
          },
          {
            foreignKeyName: "jobdesk_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "v_jabatan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobdesk_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "v_jabatan_kompetensi"
            referencedColumns: ["jabatan_id"]
          },
          {
            foreignKeyName: "jobdesk_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "v_jobdesk"
            referencedColumns: ["jabatan_id"]
          },
          {
            foreignKeyName: "jobdesk_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "v_profil_jabatan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobdesk_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "v_review_jabatan"
            referencedColumns: ["jabatan_id"]
          },
        ]
      }
      jobdesk_tugas: {
        Row: {
          alasan_tanpa_kode: string | null
          catatan_tanpa_kode: string | null
          deskripsi: string
          id: number
          jobdesk_id: number
          kategori: string | null
          saran_kompetensi: string[]
          tanpa_kompetensi: boolean
          urutan: number
        }
        Insert: {
          alasan_tanpa_kode?: string | null
          catatan_tanpa_kode?: string | null
          deskripsi: string
          id?: never
          jobdesk_id: number
          kategori?: string | null
          saran_kompetensi?: string[]
          tanpa_kompetensi?: boolean
          urutan: number
        }
        Update: {
          alasan_tanpa_kode?: string | null
          catatan_tanpa_kode?: string | null
          deskripsi?: string
          id?: never
          jobdesk_id?: number
          kategori?: string | null
          saran_kompetensi?: string[]
          tanpa_kompetensi?: boolean
          urutan?: number
        }
        Relationships: [
          {
            foreignKeyName: "jobdesk_tugas_jobdesk_id_fkey"
            columns: ["jobdesk_id"]
            isOneToOne: false
            referencedRelation: "jobdesk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobdesk_tugas_jobdesk_id_fkey"
            columns: ["jobdesk_id"]
            isOneToOne: false
            referencedRelation: "v_jobdesk"
            referencedColumns: ["id"]
          },
        ]
      }
      kompetensi: {
        Row: {
          bidang_id: number
          catatan: string[]
          created_at: string
          definisi: string | null
          diubah_di_aplikasi: string | null
          file_sumber: string | null
          id: number
          kode: string
          kode_dokumen: string | null
          nama: string
          nama_daftar_isi: string | null
          status: string
          tanda_c: boolean
          updated_at: string
          urutan: number
        }
        Insert: {
          bidang_id: number
          catatan?: string[]
          created_at?: string
          definisi?: string | null
          diubah_di_aplikasi?: string | null
          file_sumber?: string | null
          id?: never
          kode: string
          kode_dokumen?: string | null
          nama: string
          nama_daftar_isi?: string | null
          status?: string
          tanda_c?: boolean
          updated_at?: string
          urutan?: number
        }
        Update: {
          bidang_id?: number
          catatan?: string[]
          created_at?: string
          definisi?: string | null
          diubah_di_aplikasi?: string | null
          file_sumber?: string | null
          id?: never
          kode?: string
          kode_dokumen?: string | null
          nama?: string
          nama_daftar_isi?: string | null
          status?: string
          tanda_c?: boolean
          updated_at?: string
          urutan?: number
        }
        Relationships: [
          {
            foreignKeyName: "kompetensi_bidang_id_fkey"
            columns: ["bidang_id"]
            isOneToOne: false
            referencedRelation: "bidang_kompetensi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kompetensi_bidang_id_fkey"
            columns: ["bidang_id"]
            isOneToOne: false
            referencedRelation: "v_kompetensi"
            referencedColumns: ["bidang_id"]
          },
          {
            foreignKeyName: "kompetensi_bidang_id_fkey"
            columns: ["bidang_id"]
            isOneToOne: false
            referencedRelation: "v_statistik_bidang"
            referencedColumns: ["id"]
          },
        ]
      }
      kompetensi_bidang_terkait: {
        Row: {
          bidang_id: number
          catatan: string | null
          kompetensi_id: number
        }
        Insert: {
          bidang_id: number
          catatan?: string | null
          kompetensi_id: number
        }
        Update: {
          bidang_id?: number
          catatan?: string | null
          kompetensi_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "kompetensi_bidang_terkait_bidang_id_fkey"
            columns: ["bidang_id"]
            isOneToOne: false
            referencedRelation: "bidang_kompetensi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kompetensi_bidang_terkait_bidang_id_fkey"
            columns: ["bidang_id"]
            isOneToOne: false
            referencedRelation: "v_kompetensi"
            referencedColumns: ["bidang_id"]
          },
          {
            foreignKeyName: "kompetensi_bidang_terkait_bidang_id_fkey"
            columns: ["bidang_id"]
            isOneToOne: false
            referencedRelation: "v_statistik_bidang"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kompetensi_bidang_terkait_kompetensi_id_fkey"
            columns: ["kompetensi_id"]
            isOneToOne: false
            referencedRelation: "kompetensi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kompetensi_bidang_terkait_kompetensi_id_fkey"
            columns: ["kompetensi_id"]
            isOneToOne: false
            referencedRelation: "v_jabatan_kompetensi"
            referencedColumns: ["kompetensi_id"]
          },
          {
            foreignKeyName: "kompetensi_bidang_terkait_kompetensi_id_fkey"
            columns: ["kompetensi_id"]
            isOneToOne: false
            referencedRelation: "v_kompetensi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kompetensi_bidang_terkait_kompetensi_id_fkey"
            columns: ["kompetensi_id"]
            isOneToOne: false
            referencedRelation: "v_kompetensi_pemakaian"
            referencedColumns: ["id"]
          },
        ]
      }
      kompetensi_level: {
        Row: {
          deskripsi: string | null
          id: number
          kompetensi_id: number
          level: number
          nama_level: string
        }
        Insert: {
          deskripsi?: string | null
          id?: never
          kompetensi_id: number
          level: number
          nama_level: string
        }
        Update: {
          deskripsi?: string | null
          id?: never
          kompetensi_id?: number
          level?: number
          nama_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "kompetensi_level_kompetensi_id_fkey"
            columns: ["kompetensi_id"]
            isOneToOne: false
            referencedRelation: "kompetensi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kompetensi_level_kompetensi_id_fkey"
            columns: ["kompetensi_id"]
            isOneToOne: false
            referencedRelation: "v_jabatan_kompetensi"
            referencedColumns: ["kompetensi_id"]
          },
          {
            foreignKeyName: "kompetensi_level_kompetensi_id_fkey"
            columns: ["kompetensi_id"]
            isOneToOne: false
            referencedRelation: "v_kompetensi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kompetensi_level_kompetensi_id_fkey"
            columns: ["kompetensi_id"]
            isOneToOne: false
            referencedRelation: "v_kompetensi_pemakaian"
            referencedColumns: ["id"]
          },
        ]
      }
      pengaturan: {
        Row: {
          batas_gagal_login: number
          diubah_oleh: number | null
          edisi_judul: string
          edisi_keterangan: string
          id: boolean
          lama_ingat_hari: number
          lama_kunci_menit: number
          lama_sesi_jam: number
          panjang_password_min: number
          updated_at: string
        }
        Insert: {
          batas_gagal_login?: number
          diubah_oleh?: number | null
          edisi_judul?: string
          edisi_keterangan?: string
          id?: boolean
          lama_ingat_hari?: number
          lama_kunci_menit?: number
          lama_sesi_jam?: number
          panjang_password_min?: number
          updated_at?: string
        }
        Update: {
          batas_gagal_login?: number
          diubah_oleh?: number | null
          edisi_judul?: string
          edisi_keterangan?: string
          id?: boolean
          lama_ingat_hari?: number
          lama_kunci_menit?: number
          lama_sesi_jam?: number
          panjang_password_min?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pengaturan_diubah_oleh_fkey"
            columns: ["diubah_oleh"]
            isOneToOne: false
            referencedRelation: "pengguna"
            referencedColumns: ["id"]
          },
        ]
      }
      pengguna: {
        Row: {
          aktif: boolean
          created_at: string
          gagal_login: number
          id: number
          nama: string
          password_hash: string
          peran: string
          sesi_versi: number
          terakhir_login: string | null
          terkunci_sampai: string | null
          updated_at: string
          username: string
        }
        Insert: {
          aktif?: boolean
          created_at?: string
          gagal_login?: number
          id?: never
          nama: string
          password_hash: string
          peran?: string
          sesi_versi?: number
          terakhir_login?: string | null
          terkunci_sampai?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          aktif?: boolean
          created_at?: string
          gagal_login?: number
          id?: never
          nama?: string
          password_hash?: string
          peran?: string
          sesi_versi?: number
          terakhir_login?: string | null
          terkunci_sampai?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      penilaian_diri: {
        Row: {
          created_at: string
          dicentang: string[]
          id: number
          jabatan_id: number | null
          kompetensi_id: number
          level_perkiraan: number
          level_target: number | null
          pengguna_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          dicentang?: string[]
          id?: never
          jabatan_id?: number | null
          kompetensi_id: number
          level_perkiraan: number
          level_target?: number | null
          pengguna_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          dicentang?: string[]
          id?: never
          jabatan_id?: number | null
          kompetensi_id?: number
          level_perkiraan?: number
          level_target?: number | null
          pengguna_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "penilaian_diri_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "jabatan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penilaian_diri_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "v_jabatan"
            referencedColumns: ["atasan_id"]
          },
          {
            foreignKeyName: "penilaian_diri_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "v_jabatan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penilaian_diri_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "v_jabatan_kompetensi"
            referencedColumns: ["jabatan_id"]
          },
          {
            foreignKeyName: "penilaian_diri_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "v_jobdesk"
            referencedColumns: ["jabatan_id"]
          },
          {
            foreignKeyName: "penilaian_diri_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "v_profil_jabatan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penilaian_diri_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "v_review_jabatan"
            referencedColumns: ["jabatan_id"]
          },
          {
            foreignKeyName: "penilaian_diri_kompetensi_id_fkey"
            columns: ["kompetensi_id"]
            isOneToOne: false
            referencedRelation: "kompetensi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penilaian_diri_kompetensi_id_fkey"
            columns: ["kompetensi_id"]
            isOneToOne: false
            referencedRelation: "v_jabatan_kompetensi"
            referencedColumns: ["kompetensi_id"]
          },
          {
            foreignKeyName: "penilaian_diri_kompetensi_id_fkey"
            columns: ["kompetensi_id"]
            isOneToOne: false
            referencedRelation: "v_kompetensi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penilaian_diri_kompetensi_id_fkey"
            columns: ["kompetensi_id"]
            isOneToOne: false
            referencedRelation: "v_kompetensi_pemakaian"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "penilaian_diri_pengguna_id_fkey"
            columns: ["pengguna_id"]
            isOneToOne: false
            referencedRelation: "pengguna"
            referencedColumns: ["id"]
          },
        ]
      }
      review_jabatan: {
        Row: {
          catatan: string | null
          jabatan_id: number
          peninjau: string | null
          status: string
          updated_at: string
        }
        Insert: {
          catatan?: string | null
          jabatan_id: number
          peninjau?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          catatan?: string | null
          jabatan_id?: number
          peninjau?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_jabatan_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: true
            referencedRelation: "jabatan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_jabatan_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: true
            referencedRelation: "v_jabatan"
            referencedColumns: ["atasan_id"]
          },
          {
            foreignKeyName: "review_jabatan_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: true
            referencedRelation: "v_jabatan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_jabatan_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: true
            referencedRelation: "v_jabatan_kompetensi"
            referencedColumns: ["jabatan_id"]
          },
          {
            foreignKeyName: "review_jabatan_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: true
            referencedRelation: "v_jobdesk"
            referencedColumns: ["jabatan_id"]
          },
          {
            foreignKeyName: "review_jabatan_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: true
            referencedRelation: "v_profil_jabatan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_jabatan_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: true
            referencedRelation: "v_review_jabatan"
            referencedColumns: ["jabatan_id"]
          },
        ]
      }
      review_riwayat: {
        Row: {
          aksi: string
          catatan: string | null
          created_at: string
          id: number
          jabatan_id: number
          pengguna_id: number | null
          peninjau: string | null
          status_dari: string | null
          status_ke: string | null
        }
        Insert: {
          aksi: string
          catatan?: string | null
          created_at?: string
          id?: never
          jabatan_id: number
          pengguna_id?: number | null
          peninjau?: string | null
          status_dari?: string | null
          status_ke?: string | null
        }
        Update: {
          aksi?: string
          catatan?: string | null
          created_at?: string
          id?: never
          jabatan_id?: number
          pengguna_id?: number | null
          peninjau?: string | null
          status_dari?: string | null
          status_ke?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_riwayat_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "jabatan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_riwayat_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "v_jabatan"
            referencedColumns: ["atasan_id"]
          },
          {
            foreignKeyName: "review_riwayat_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "v_jabatan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_riwayat_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "v_jabatan_kompetensi"
            referencedColumns: ["jabatan_id"]
          },
          {
            foreignKeyName: "review_riwayat_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "v_jobdesk"
            referencedColumns: ["jabatan_id"]
          },
          {
            foreignKeyName: "review_riwayat_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "v_profil_jabatan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_riwayat_jabatan_id_fkey"
            columns: ["jabatan_id"]
            isOneToOne: false
            referencedRelation: "v_review_jabatan"
            referencedColumns: ["jabatan_id"]
          },
          {
            foreignKeyName: "review_riwayat_pengguna_id_fkey"
            columns: ["pengguna_id"]
            isOneToOne: false
            referencedRelation: "pengguna"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_kerja: {
        Row: {
          catatan: string | null
          direktorat: string | null
          id: number
          jenis: string
          kode: string
          nama: string
          parent_id: number | null
          urutan: number
        }
        Insert: {
          catatan?: string | null
          direktorat?: string | null
          id?: never
          jenis: string
          kode: string
          nama: string
          parent_id?: number | null
          urutan?: number
        }
        Update: {
          catatan?: string | null
          direktorat?: string | null
          id?: never
          jenis?: string
          kode?: string
          nama?: string
          parent_id?: number | null
          urutan?: number
        }
        Relationships: [
          {
            foreignKeyName: "unit_kerja_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "unit_kerja"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_kerja_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "v_jabatan"
            referencedColumns: ["unit_kerja_id"]
          },
        ]
      }
    }
    Views: {
      v_cek_level_atasan: {
        Row: {
          atasan_kode: string | null
          atasan_nama: string | null
          jabatan_kode: string | null
          jabatan_nama: string | null
          kompetensi_kode: string | null
          kompetensi_nama: string | null
          level_atasan: number | null
          level_bawahan: number | null
          unit_nama: string | null
        }
        Relationships: []
      }
      v_cek_level_kamus: {
        Row: {
          jabatan_kode: string | null
          jabatan_nama: string | null
          kompetensi_kode: string | null
          kompetensi_nama: string | null
          level_target: number | null
          level_tersedia: number | null
        }
        Relationships: []
      }
      v_jabatan: {
        Row: {
          atasan_id: number | null
          atasan_kode: string | null
          atasan_nama: string | null
          catatan: string | null
          direktorat: string | null
          id: number | null
          ikhtisar_jabatan: string | null
          jenjang: number | null
          jumlah_kompetensi: number | null
          kelompok_jabatan: string | null
          kode: string | null
          nama: string | null
          nama_asli: string | null
          unit_induk_nama: string | null
          unit_jenis: string | null
          unit_kerja_id: number | null
          unit_kode: string | null
          unit_nama: string | null
          uraian_tugas: string[] | null
          urutan: number | null
        }
        Relationships: []
      }
      v_jabatan_kompetensi: {
        Row: {
          bidang_kode: string | null
          bidang_nama: string | null
          bukti: number[] | null
          catatan: string | null
          id: number | null
          jabatan_id: number | null
          jabatan_kode: string | null
          jabatan_nama: string | null
          jenjang: number | null
          kategori: string | null
          kompetensi_id: number | null
          kompetensi_kode: string | null
          kompetensi_nama: string | null
          level_deskripsi: string | null
          level_target: number | null
          metode: string | null
          nama_level: string | null
          skor: number | null
          sumber: string | null
        }
        Relationships: []
      }
      v_jobdesk: {
        Row: {
          atasan_langsung: string | null
          file_sumber: string | null
          fungsi: string[] | null
          id: number | null
          jabatan_id: number | null
          jabatan_kode: string | null
          jabatan_nama: string | null
          jumlah_tugas: number | null
          kelompok_unit: string | null
          kode_dokumen: string | null
          membawahi: string[] | null
          nama_jabatan: string | null
          pangkat: string | null
          pendidikan: string | null
          pengalaman_kerja: string | null
          urutan: number | null
        }
        Relationships: []
      }
      v_kompetensi: {
        Row: {
          bidang_id: number | null
          bidang_kode: string | null
          bidang_nama: string | null
          catatan: string[] | null
          definisi: string | null
          id: number | null
          jumlah_indikator: number | null
          jumlah_level: number | null
          kategori: string | null
          kode: string | null
          kode_dokumen: string | null
          nama: string | null
          status: string | null
          tanda_c: boolean | null
          urutan: number | null
        }
        Relationships: []
      }
      v_kompetensi_pemakaian: {
        Row: {
          bidang_kode: string | null
          bidang_nama: string | null
          bidang_urutan: number | null
          id: number | null
          jumlah_jabatan: number | null
          kategori: string | null
          kode: string | null
          nama: string | null
          status: string | null
          urutan: number | null
        }
        Relationships: []
      }
      v_level_indikator: {
        Row: {
          id: number | null
          jumlah_indikator: number | null
          kode: string | null
          level: number | null
          nama: string | null
          nama_level: string | null
        }
        Relationships: []
      }
      v_profil_jabatan: {
        Row: {
          ada_manual: boolean | null
          id: number | null
          jenjang: number | null
          jumlah_inti: number | null
          jumlah_kepemimpinan: number | null
          jumlah_kompetensi: number | null
          jumlah_teknis: number | null
          kelompok_jabatan: string | null
          kode: string | null
          nama: string | null
          profil: string[] | null
          rata_level: number | null
          unit_induk_nama: string | null
          unit_nama: string | null
          urutan: number | null
        }
        Relationships: []
      }
      v_review_jabatan: {
        Row: {
          catatan: string | null
          jabatan_id: number | null
          jenjang: number | null
          kelompok_jabatan: string | null
          kode: string | null
          nama: string | null
          peninjau: string | null
          status: string | null
          unit_induk_nama: string | null
          unit_nama: string | null
          updated_at: string | null
          urutan: number | null
        }
        Relationships: []
      }
      v_statistik_bidang: {
        Row: {
          id: number | null
          jumlah_dengan_catatan: number | null
          jumlah_indikator: number | null
          jumlah_kompetensi: number | null
          jumlah_lengkap: number | null
          jumlah_perlu_tindak_lanjut: number | null
          jumlah_tanda_c: number | null
          kategori: string | null
          kode: string | null
          nama: string | null
          urutan: number | null
        }
        Relationships: []
      }
      v_statistik_level: {
        Row: {
          jumlah_level: number | null
          level: number | null
          nama_level: string | null
          rata_indikator: number | null
          tanpa_indikator: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      catat_gagal_login: {
        Args: { p_batas: number; p_id: number; p_menit: number }
        Returns: undefined
      }
      simpan_kompetensi: {
        Args: {
          p_catatan: string[]
          p_definisi: string
          p_id: number
          p_levels: Json
          p_nama: string
          p_status: string
        }
        Returns: string
      }
      simpan_pemetaan: {
        Args: { p_jabatan_id: number; p_rows: Json }
        Returns: undefined
      }
      simpan_tugas_jobdesk: {
        Args: { p_jabatan_id: number; p_jobdesk_id: number; p_tugas: Json }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

